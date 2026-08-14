# Use Cases: Hook Infrastructure and Non-Blocking Hooks

> Based on [PRD](../PRD.md) — Section 7: Hook Infrastructure and Non-Blocking Hooks

**System context (do not assume otherwise):** This feature has no UI, no server, and no database. It is entirely local: three Claude Code lifecycle hooks (`SessionStart`, `PostToolUse` matched on `Edit|Write`, and `Stop`) that Claude Code itself spawns as short-lived Node child processes on the developer's own machine, communicating over stdin/stdout JSON. There is no HTTP boundary anywhere in this document. Actors are: **Claude Code** (the host process that spawns hook processes, applies their exit code, and optionally consumes their stdout JSON), the **Developer** (whose live session and tool calls are affected, usually while an autonomous `/develop-feature` or `/implement-slice` run is in progress), and the **hook script** itself — the shared wrapper `hooks/lib/run-hook.js` plus whichever handler module it dispatches to for a given hook id (`hooks/handlers/session-start-spine.js`, `hooks/handlers/post-edit-accumulate.js`, `hooks/handlers/stop-typecheck-format.js` — illustrative filenames per the PRD's own footnote on 7.6; only `hooks/hooks.json` and `hooks/lib/run-hook.js` are fixed paths, FR-1.1/FR-2.1). Every scenario below has a mechanically checkable outcome: a process exit code, a specific JSON field in the hook's stdout, the presence/absence/content of a file, or a substring in an emitted message.

**Hook I/O contract (referenced throughout, do not restate per use case):**
- **stdin** (Claude Code → hook process): one JSON object per Claude Code's own hook protocol, always including `session_id`, `transcript_path`, `cwd`, `hook_event_name`. `SessionStart` additionally carries `source` (`"startup"|"resume"|"clear"|"compact"`); `PostToolUse` additionally carries `tool_name` (`"Edit"|"Write"`), `tool_input`, `tool_response`; `Stop` additionally carries `stop_hook_active`.
- **stdout** (hook process → Claude Code), only meaningful on exit `0`:
  ```json
  {
    "continue": true,
    "systemMessage": "<optional, one line, shown to the developer>",
    "hookSpecificOutput": {
      "hookEventName": "SessionStart",
      "additionalContext": "<optional, SessionStart only, folded into the model's context for that turn>"
    }
  }
  ```
  `systemMessage` is the field every fail-open exit (FR-3.4) and every non-fail-open advisory notice (the drift report, the no-typecheck-configured note, a typecheck-failure report) is carried on. `hookSpecificOutput.additionalContext` is the field `session:start:spine` uses to inject scratchpad state; the other two hooks never populate it.
- **Exit codes**: `0` = proceed. Claude Code applies the tool call or lifecycle event exactly as if the hook had not fired, except that it also surfaces `systemMessage`/`additionalContext` if present and parseable. `2` = block (stderr fed back to the model as the block reason). **No hook shipped by this feature is ever permitted to exit `2`, under any input or condition (FR-3.5); no scenario in this document produces it.** Only Section 8 (not yet built, out of scope here) will ever introduce a `2` exit anywhere in this harness.
- **Exit code and stdout content are independently governed.** Proceed-vs-block is decided by exit code alone (`0` vs `2`); malformed, missing, or unparseable stdout on an exit-`0` process degrades only the advisory content (no `systemMessage`, no `additionalContext` delivered) — it never turns a `0` into a block. This independence is what makes FR-3's fail-open contract enforceable even when a handler's own output-writing logic misbehaves — see UC-3-E6.
- **Runtime controls (environment variables)**: `SDLC_HOOKS_ENABLED` (`0` disables every hook, FR-4.2), `SDLC_DISABLED_HOOKS` (comma-separated hook ids to disable individually, FR-4.3), `SDLC_HOOK_PROFILE` (`minimal|standard|strict`, default/fallback `standard`, FR-4.4–FR-4.6), `SDLC_SESSION_CONTEXT_MAX_CHARS` (default `4000`, caps `session:start:spine`'s injected text, FR-5.2).
- **The 3 hook ids** (namespaced `<scope>:<event>:<name>`, FR-4.1): `session:start:spine` (`SessionStart`), `post:edit:accumulate` (`PostToolUse`, matcher `Edit|Write`), `stop:typecheck-format` (`Stop`).

---

## UC-1: Hook Runtime Bootstrap — Plugin Installed, `hooks.json` Loaded, Hooks Fire

**Actor**: Claude Code; Developer
**Preconditions**:
- The plugin is installed (`/plugin install`) on this machine, and `.claude-plugin/plugin.json` declares the `hooks` component path `"./hooks/"` (FR-1.2)
- `hooks/hooks.json` exists at the plugin root and declares exactly 3 entries — one `SessionStart`, one `PostToolUse` matched on `Edit|Write`, one `Stop` — each routed through `hooks/lib/run-hook.js` with its namespaced id (FR-1.4)
- `claude plugin validate .` exits `0` with both `hooks/hooks.json` and the `plugin.json` `hooks` field present (FR-1.3, AC-1)

**Trigger**: The developer starts a Claude Code session in a project (SessionStart), edits or writes a file during that session (PostToolUse on `Edit`/`Write`), or the assistant's response ends (Stop)

### Primary Flow (Happy Path)
1. Developer opens a Claude Code session. Claude Code reads the plugin's `hooks/hooks.json` (auto-loaded at plugin-install time per FR-1.1 — no copy into any `settings.json` is read or required) and registers its 3 entries against `SessionStart`, `PostToolUse`, and `Stop`.
2. Claude Code fires the `SessionStart` event and spawns the configured command, which invokes `node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-hook.js" --hook session:start:spine`.
3. `run-hook.js` resolves its own installation root from the `CLAUDE_PLUGIN_ROOT` environment variable Claude Code provides to the child process (FR-2.2) — not from the current working directory — so hook resolution is identical regardless of which project directory the session is in.
4. `run-hook.js` asserts the running Node version meets its minimum (FR-2.3), applies the hook's configured timeout (FR-2.4), and dispatches by hook id (FR-2.5) to `session-start-spine`'s handler logic.
5. The handler runs to completion, `run-hook.js` writes its stdout JSON envelope, and the process exits `0`.
6. Claude Code applies the envelope (folds any `additionalContext` into the session, surfaces any `systemMessage`) and the session proceeds normally.
7. Later, the developer performs an `Edit` tool call. Claude Code fires `PostToolUse`, spawns `run-hook.js --hook post:edit:accumulate`, the handler appends the edited path to its accumulator file, exits `0`.
8. The assistant's response ends. Claude Code fires `Stop`, spawns `run-hook.js --hook stop:typecheck-format`, the handler runs the accumulated checks, exits `0`.

**Postconditions**: All 3 hook ids are registered and invoked at their respective lifecycle events on every matching occurrence for the remainder of the session; every invocation resolves the plugin root via `CLAUDE_PLUGIN_ROOT` rather than `cwd`; no invocation blocks its surrounding event.

### Alternative Flows
- **UC-1-A1: Multiple projects in the same Claude Code installation** — the developer works across two different project directories in separate sessions on the same machine. `run-hook.js`'s `CLAUDE_PLUGIN_ROOT`-based resolution (step 3) means hook behavior is identical in both projects; only the per-project inputs (`.claude/scratchpad.md`, the project's declared typecheck command) differ, not the hook's own resolution logic.
- **UC-1-A2: A tool call that does not match `Edit|Write`** (e.g., `Bash`, `Read`, `Grep`) — `post:edit:accumulate`'s matcher does not match, so `PostToolUse` fires but no command for this hook is spawned at all; this is a normal non-match, not a failure, and produces no exit code to reason about for this hook id.

### Error Flows
- **UC-1-E1: `hooks/hooks.json` is malformed JSON** (e.g., a trailing comma or unclosed brace from a hand-edit) — `claude plugin validate .` fails to load it and reports a parse error at plugin-install time; no hook entries register at all on this machine until the file is corrected. This is a build-time/install-time defect caught by AC-1's validation gate and `scripts/ci/validate-hooks.js` (FR-8.4), not a runtime fail-open scenario — it never reaches a live tool call.
- **UC-1-E2: A hook entry's `command` field does not invoke `run-hook.js`** (a hand-edited or defectively-generated entry inlines a different script, violating FR-2.1) — this is a configuration defect, not covered by the fail-open contract at all, since FR-3's guarantees apply only to hooks correctly routed through `run-hook.js`; `scripts/ci/validate-hooks.js` MUST catch this at CI time (FR-8.4) rather than relying on runtime behavior to paper over it.

### Edge Cases
- **UC-1-EC1**: `CLAUDE_PLUGIN_ROOT` is unset or empty in the spawned process's environment (a Claude Code defect, or a non-standard invocation). `run-hook.js` cannot resolve its own root reliably; this is treated identically to "cannot spawn or run" under FR-3.3 — the wrapper fails open (exit `0`, `systemMessage` naming the hook id and a resolution failure) rather than throwing an unhandled error that could propagate a non-zero exit.
- **UC-1-EC2**: The developer's session spans a compaction event mid-run. `SessionStart` fires again with `source: "compact"`; the bootstrap sequence (steps 2–6) repeats identically — this is the exact scenario `session:start:spine` exists to serve (see UC-5).

### Data Requirements
- **Input**: `.claude-plugin/plugin.json`'s `hooks` field; `hooks/hooks.json`'s 3 entries; `CLAUDE_PLUGIN_ROOT`, `session_id`, `transcript_path`, `cwd`, and event-specific stdin fields Claude Code provides per invocation
- **Output**: Per-invocation exit code (`0` in every scenario this feature ships) and, when present, a stdout JSON envelope (`continue`, `systemMessage`, `hookSpecificOutput.additionalContext`)
- **Side Effects**: None beyond what each individual handler does (scratchpad read, accumulator file append, typecheck/format command execution) — bootstrap itself performs no writes

---

## UC-2: Plugin Not Installed — No Hooks Fire, Harness Still Functions Unenforced

**Actor**: Claude Code; Developer
**Preconditions**: The plugin has never been installed on this machine (or was uninstalled), regardless of whether `install.sh`'s memory layer (`~/.claude/claude.md`, `~/.claude/rules/*.md`) is present — hooks ship exclusively through the plugin and are never installed by `install.sh` (see `plugin-repackaging_use_cases.md` UC-10 for the `install.sh`-only case this scenario composes with)

**Trigger**: The developer starts a session, edits a file, or ends a response in a Claude Code environment with no plugin installed

### Primary Flow (Documented, Non-Broken Outcome)
1. Developer starts a Claude Code session. No `hooks/hooks.json` was ever loaded, because no plugin registered it — there is no configuration for `SessionStart`, `PostToolUse`, or `Stop` to match against.
2. Session start, every `Edit`/`Write` tool call, and every response's `Stop` event occur with zero hook processes spawned for any of the 3 ids — not a fast no-op invocation, a genuine absence of invocation.
3. The developer's autonomous pipeline still runs to merge-ready if `install.sh`'s memory layer is present (the mandatory-workflow prose instruction, error-recovery rules, scratchpad rules), exactly as it did before this feature existed — Section 7 adds nothing this machine can observe.
4. None of this feature's mechanical guarantees are available: no scratchpad re-entry context is injected at session start, no drift check runs, no batched typecheck/format runs at Stop, and permission defaults are whatever `templates/settings.json` a project happened to scaffold with (independent of hooks).

**Postconditions**: The harness behaves identically to a Section-6-only installation with no hooks configured (NFR-2) — fully functional via prose-only enforcement, with none of this feature's mechanical checks active.

### Alternative Flows
- **UC-2-A1: `SDLC_HOOKS_ENABLED=0` on a machine where the plugin IS installed** — behaviorally indistinguishable from this UC's primary flow from the developer's perspective (see UC-4), even though `hooks/hooks.json` is loaded in that case; this UC is the "never registered" case, UC-4 is the "registered but suppressed" case.

### Error Flows
- **UC-2-E1: Developer assumes hooks are protecting them because the plugin's `agents`/`skills` are installed** — `/agents` resolving all 13 agents and `/plugin install` reporting success are both true on a machine where hooks are simply not registered for an unrelated reason (e.g., a corrupted `hooks/hooks.json` failed plugin validation at install time — see UC-1-E1). There is no runtime signal that distinguishes "hooks never registered" from "hooks registered and silently fail-opening on every call" from the developer's ordinary session experience alone, since both produce zero observable hook output. Detection requires checking `claude plugin validate .`'s exit code and, once F2b (Section 8) ships blocking guards, noticing their absence; for this feature's observe/advise hooks, the only directly observable symptom is the absence of `session:start:spine`'s scratchpad-derived `additionalContext` at session start on a project with a populated `.claude/scratchpad.md`.

### Edge Cases
- **UC-2-EC1**: The plugin is installed later, mid-project. The very next `SessionStart` after installation completes fires `session:start:spine` for the first time on this machine; no retroactive re-processing of tool calls or Stop events that already happened before installation occurs — hooks apply prospectively only.

### Data Requirements
- **Input**: Plugin installation state (absent)
- **Output**: A session that proceeds identically to a no-hooks-configured baseline
- **Side Effects**: None — no hook process is ever spawned, so no accumulator file is created, no scratchpad is read by a hook, no drift check runs

---

## UC-3: Fail-Open Contract — Every Failure Shape Results in Exit `0` and the Tool Call Proceeds

This is the most important cluster in this document. A blocking failure anywhere in this UC would dead-end an unattended pipeline run — the exact defect FR-3 exists to make structurally impossible.

**Actor**: Hook script (`run-hook.js` and the dispatched handler); Claude Code; Developer
**Preconditions**: A hook entry is registered and about to fire (any of the 3 ids); the scenario below injects a malfunction into the handler, the runtime, or the configuration

**Trigger**: A hook invocation encounters one of six failure shapes: handler throws, handler exceeds its timeout, Node is missing entirely, Node is present but below the minimum version, `hooks.json`/dispatch table references a handler module that does not exist on disk, or the process's own stdout does not parse as valid JSON

### Primary Flow (Baseline — No Malfunction, for Contrast)
1. A hook fires, its handler completes normally within its timeout, under a sufficient Node version, and writes a well-formed stdout JSON envelope.
2. The process exits `0`.
3. Claude Code proceeds with the surrounding tool call or lifecycle event, applying any `systemMessage`/`additionalContext` present.

**Postconditions**: The tool call or event completes exactly as if no hook were configured, plus any advisory content actually delivered.

### Error Flows (the six failure shapes — each is the actual scenario under test)

- **UC-3-E1: Handler throws an uncaught exception (FR-3.1)**
  1. The dispatched handler (e.g. `session-start-spine.js`) throws during execution — for example, a `JSON.parse` on unexpected scratchpad content, or a null-dereference on a missing field.
  2. `run-hook.js`'s own dispatch call is wrapped so the exception is caught, never propagated to the process's own uncaught-exception handler.
  3. `run-hook.js` writes `{"continue": true, "systemMessage": "session:start:spine: hook failed (exception) — proceeding without it"}` (or equivalent, naming the hook id and reason `exception` per FR-3.4) to stdout and exits `0`.
  4. Claude Code proceeds with the surrounding tool call/event exactly as if `session:start:spine` had not fired at all beyond the visible message.
  5. **Mechanically checkable outcome**: exit code `0`; stdout JSON's `systemMessage` contains the hook id and the string `exception` (or an equivalent explicit reason token); no `additionalContext` is delivered for this invocation.

- **UC-3-E2: Handler exceeds its configured timeout (FR-3.2)**
  1. The dispatched handler hangs or runs longer than the timeout `run-hook.js` applies for this specific hook id (FR-2.4 — independently configurable per hook id).
  2. `run-hook.js` terminates the handler's execution at the timeout boundary rather than waiting indefinitely.
  3. `run-hook.js` writes a `systemMessage` naming the hook id and reason `timeout` and exits `0`.
  4. Claude Code proceeds with the surrounding tool call/event.
  5. **Mechanically checkable outcome**: exit code `0`; total wall-clock time for the invocation is bounded by the configured timeout (not unbounded); `systemMessage` contains the hook id and the string `timeout`.

- **UC-3-E3: Node is missing entirely from `PATH` (FR-3.3)**
  1. Claude Code's own hook engine attempts to spawn the configured command (`node "${CLAUDE_PLUGIN_ROOT}/hooks/lib/run-hook.js" --hook <id>`) on a machine with no `node` binary reachable on `PATH`.
  2. The spawn itself fails at the OS/shell level (e.g., "command not found") before any line of `run-hook.js`'s own code executes — there is no wrapper process to write a `systemMessage` or apply its own timeout, because it never started.
  3. **This specific case's fail-open guarantee is therefore not produced by this feature's own code** — it depends on Claude Code's own hook engine treating a hook command that fails to spawn as non-blocking (logged, not fed back as a block reason), exactly as CI's Node-toolchain-setup-step distinction does for `scripts/ci/*.js` (see `plugin-repackaging_use_cases.md` UC-14-E2 for the directly analogous CI case). FR-3.3's text ("the wrapper process MUST exit `0`") is honored only in the sense that Claude Code's own spawn-failure path must not translate into a block — there is no wrapper process exit code to assert on in this exact sub-case.
  4. **Mechanically checkable outcome**: the surrounding tool call/event still completes (not blocked); this is verified at the level of "did the overall session/tool-call proceed," not by asserting on `run-hook.js`'s own stdout, since none is produced. FR-8.3's "simulated Node-unavailable condition" test MUST simulate this case by shadowing `node` on `PATH` with an absent/non-executable stand-in for the test's duration and asserting the calling harness is not blocked — it cannot feed crafted stdin to a process that never starts.

- **UC-3-E4: Node is present but below the minimum version asserted by `run-hook.js` (FR-2.3, FR-3.3)**
  1. `run-hook.js` starts successfully (Node exists and can execute at least enough of the script to reach the version check) under an installed Node version below the asserted minimum.
  2. `run-hook.js`'s version-assertion step (FR-2.3) detects the shortfall before dispatching to any handler logic.
  3. `run-hook.js` writes a `systemMessage` naming the required minimum, the detected version, and reason `node-unavailable`, and exits `0` — treated as a no-op per FR-3.3, identical in effect to UC-3-E3 from the surrounding tool call's perspective.
  4. **Mechanically checkable outcome**: exit code `0`; `systemMessage` names both the required minimum and the detected version; no handler logic executes (verifiable by asserting the handler's own side effects — e.g. no accumulator write, no scratchpad read — did not occur).
  5. **This case, unlike UC-3-E3, IS directly fixture-testable**: `run-hook.js` does start and does run its own code, so FR-8.1's "feed crafted stdin to the hook (invoked through `run-hook.js`)" applies normally here; the test harness runs the real `run-hook.js` under an actually-old Node binary, or injects a version-check override, and asserts on real stdout/exit code.
  6. Per FR-3.4/FR-8.3, this case and UC-3-E3 share the same canonical reason token `node-unavailable` — they are one failure category with two different mechanisms of onset, not two categories.

- **UC-3-E5: `hooks.json`/dispatch table references a handler module that does not exist on disk**
  1. `hooks/hooks.json` never contains a per-hook handler file path (Design Decision 2 — every entry invokes only `run-hook.js`, passing a hook id); the file-existence question instead applies to `run-hook.js`'s own internal id-to-handler dispatch table (FR-2.5), which maps e.g. `stop:typecheck-format` to `hooks/handlers/stop-typecheck-format.js`.
  2. That handler module file has been deleted, renamed, or was never shipped for an id present in the dispatch table (a packaging or refactor defect) — `run-hook.js` starts normally, passes its own version check, and reaches the dispatch step.
  3. Requiring/importing the missing module throws (Node's own module-resolution error) — this is caught by the identical try/catch that governs UC-3-E1, since it occurs "invoked through `run-hook.js`" during dispatch.
  4. `run-hook.js` writes a `systemMessage` naming the hook id and reason `exception` (module-not-found is a thrown exception, not a distinct FR-3.4 reason category) and exits `0`.
  5. **Mechanically checkable outcome**: exit code `0`; `systemMessage` contains the hook id; the surrounding tool call/event proceeds. A fixture test constructs this by pointing the dispatch table (or a copy of it under test) at a path that does not exist and asserting the same exit-`0`/`systemMessage` contract as UC-3-E1.

- **UC-3-E6: The process's own stdout does not parse as valid JSON**
  1. A defect causes `run-hook.js`'s final stdout write to be corrupted — for example, a handler bypasses the wrapper's own output discipline and writes directly to `process.stdout` (a stray `console.log` used for debugging) ahead of the wrapper's own JSON write, or a value returned by the handler cannot be `JSON.stringify`'d cleanly (e.g. a circular reference).
  2. `run-hook.js`'s own stdout-serialization step is itself wrapped defensively, so a stringify failure is caught by the same path as UC-3-E1 (exit `0`, `systemMessage` reason `exception`) rather than crashing the process with no exit code at all.
  3. In the narrower sub-case where the process still exits `0` but its stdout contains extra non-JSON text (the stray-`console.log` scenario) rather than throwing, Claude Code's own hook-output parsing simply cannot extract `hookSpecificOutput`/`systemMessage` from it — per the exit-code/stdout-content independence stated in this document's system context, this degrades only the advisory content, never proceed-vs-block.
  4. **Mechanically checkable outcome**: exit code `0` in both sub-cases; the surrounding tool call/event proceeds regardless of whether Claude Code successfully parsed the stdout payload. The only observable loss is that no `additionalContext`/`systemMessage` is delivered for that specific invocation — never a block.

**Postconditions (all six error flows)**: The surrounding tool call or lifecycle event completes as if the hook had not fired (beyond any successfully-delivered `systemMessage`); no exit code other than `0` is ever produced by any of these six scenarios; no scenario in this UC ever produces exit code `2`.

### Edge Cases
- **UC-3-EC1: Two failure shapes overlap in one invocation** — e.g., the handler is about to throw but is also running past its timeout at the same instant. Whichever detection fires first (timeout enforcement is external to the handler's own execution and can preempt it) determines the reported reason (`timeout` vs `exception`); either is an acceptable, correct outcome, since both still exit `0` — the two categories are not required to be mutually exclusive in their detection ordering, only in their guarantee (always `0`).
- **UC-3-EC2: The failure occurs inside `session:start:spine` specifically, which also has its own no-op/silent paths (UC-5, UC-6)** — a genuine parse exception on unreadable scratchpad content (UC-3-E1) is distinct from FR-5.3's documented, non-error no-op when `.claude/scratchpad.md` is simply absent; the two must not be conflated — an absent file is expected and silent, a present-but-unreadable file is an exception path that still exits `0` but does emit a `systemMessage`.
- **UC-3-EC3: `SDLC_HOOKS_ENABLED=0` is also set while a handler would otherwise throw** — per FR-4.2, `run-hook.js` exits `0` immediately without executing any hook's logic at all when disabled; the would-be exception never has a chance to occur, and no `systemMessage` about a failure is produced, only (at most) the runtime-control's own no-op path (see UC-4).

### Data Requirements
- **Input**: Crafted stdin fixtures per hook id (FR-8.1); a deliberately malfunctioning handler variant per failure shape (FR-8.3); an environment with `node` absent or below minimum, for UC-3-E3/E4
- **Output**: Exit code `0` in every case; a `systemMessage` naming the hook id and one of the three canonical reasons (`exception`, `timeout`, `node-unavailable`) for every case except UC-3-E3 (no process exists to emit one) and the sub-case of UC-3-E6 where stdout is present but corrupted rather than absent
- **Side Effects**: None beyond the `systemMessage` itself — no handler's normal side effects (accumulator write, scratchpad read, typecheck/format execution) occur when its own invocation is the one that failed

---

## UC-4: Runtime Controls — `SDLC_HOOKS_ENABLED`, `SDLC_DISABLED_HOOKS`, `SDLC_HOOK_PROFILE`

**Actor**: Developer (sets the environment variable); Hook script (`run-hook.js` reads it at the top of every invocation)
**Preconditions**: The plugin is installed and `hooks/hooks.json`'s 3 entries are registered (UC-1's preconditions hold)

**Trigger**: One or more of `SDLC_HOOKS_ENABLED`, `SDLC_DISABLED_HOOKS`, `SDLC_HOOK_PROFILE` is set in the environment a Claude Code session (and therefore every hook child process it spawns) inherits

### Primary Flow (`SDLC_HOOKS_ENABLED=0` Disables Every Hook)
1. Developer sets `SDLC_HOOKS_ENABLED=0` before starting a session (or exports it into the shell Claude Code runs in).
2. A `SessionStart`, `PostToolUse` (`Edit|Write`), or `Stop` event fires; Claude Code spawns `run-hook.js --hook <id>` as configured.
3. `run-hook.js` checks `SDLC_HOOKS_ENABLED` before dispatching to any handler logic (FR-4.2) and finds it set to `0`.
4. `run-hook.js` exits `0` immediately, without executing `session-start-spine`/`post-edit-accumulate`/`stop-typecheck-format`'s handler logic at all — no scratchpad read, no accumulator write, no typecheck run.
5. This is identical for all 3 hook ids, every time, for the duration the variable remains set.

**Postconditions**: No hook produces any side effect or advisory content for the duration `SDLC_HOOKS_ENABLED=0` is set; every invocation still exits `0`; behavior matches UC-2 (plugin not installed) from the developer's observable perspective, even though `hooks.json` is loaded.

### Alternative Flows
- **UC-4-A1: `SDLC_DISABLED_HOOKS=session:start:spine` disables exactly one hook (AC-3)**
  1. Developer sets `SDLC_DISABLED_HOOKS=session:start:spine`.
  2. A session starts; `run-hook.js --hook session:start:spine` checks the comma-separated list (FR-4.3), finds its own id present, and exits `0` immediately with no `additionalContext` injected — verifiable by a fixture test asserting no `additionalContext` is present in this invocation's stdout.
  3. In the same run, an `Edit` tool call fires `post:edit:accumulate` and the response's end fires `stop:typecheck-format` — neither id appears in `SDLC_DISABLED_HOOKS`, so both execute their normal logic unaffected (AC-3's explicit requirement).
  4. **Mechanically checkable outcome**: `session:start:spine`'s invocation produces no `additionalContext`; `post:edit:accumulate`'s accumulator file still receives the edited path; `stop:typecheck-format` still runs its normal batched check.
- **UC-4-A2: `SDLC_DISABLED_HOOKS` lists multiple ids** (e.g. `session:start:spine,stop:typecheck-format`) — each listed id individually no-ops per UC-4-A1's mechanism; `post:edit:accumulate` (not listed) is unaffected.
- **UC-4-A3: `SDLC_HOOK_PROFILE=minimal|standard|strict` gates a hook by its declared profile membership**
  1. Each hook declares, in its own configuration or handler metadata, which of the 3 profiles it belongs to (FR-4.4); all 3 hooks shipped by this feature declare `standard` membership at minimum (FR-4.7) — this document does not assert which, if any, of the 3 also declare `minimal` or `strict`, since the PRD leaves that assignment to the implementation beyond the `standard`-at-minimum floor.
  2. `SDLC_HOOK_PROFILE=standard` (or unset, per FR-4.6) is the baseline: all 3 hooks run normally, per UC-1's primary flow.
  3. `SDLC_HOOK_PROFILE=minimal` or `=strict` is set: for any hook whose declared profile list does not include the active profile, `run-hook.js` exits `0` for that hook id without executing its handler logic (FR-4.4) — mechanically identical in effect to UC-4-A1, but driven by profile membership instead of an explicit id list. Because FR-4.7 only guarantees `standard` membership for the 3 named hooks, QA test cases exercising `minimal`/`strict` gating specifically should do so against a test-fixture hook with a controlled, explicit profile declaration, then separately verify the real profile declarations the implementation chose for the 3 named hooks once built.

### Error Flows
- **UC-4-E1: `SDLC_HOOK_PROFILE` set to an invalid value falls back to `standard` (FR-4.5)**
  1. Developer sets `SDLC_HOOK_PROFILE=turbo` (not one of `minimal`, `standard`, `strict` — a typo or a value from an unrelated tool).
  2. `run-hook.js` reads the value, finds it does not match any of the 3 recognized profiles.
  3. `run-hook.js` treats the session as if `SDLC_HOOK_PROFILE=standard` were set — it does not fail, does not block, and does not treat the invalid value as equivalent to "no hooks configured."
  4. All 3 hooks (each declaring `standard` membership at minimum, FR-4.7) run normally.
  5. **Mechanically checkable outcome**: with `SDLC_HOOK_PROFILE=turbo` set, hook behavior for all 3 ids is identical to `SDLC_HOOK_PROFILE=standard` (or unset) — verified by comparing the two runs' `additionalContext`/accumulator/typecheck outcomes and finding no difference attributable to the invalid value.

### Edge Cases
- **UC-4-EC1**: `SDLC_HOOKS_ENABLED` is set to a value other than `0` (e.g. `1`, `true`, empty string) — only the literal `0` disables hooks per FR-4.2's wording; any other value (including an accidental empty-string export) MUST be treated as enabled, not as an ambiguous or disabled state, since the requirement's guard condition is specifically "set to `0`," not "set to any falsy-looking value."
- **UC-4-EC2**: `SDLC_HOOKS_ENABLED=0` and `SDLC_DISABLED_HOOKS` are both set simultaneously — the global kill switch (FR-4.2) takes effect for every hook regardless of the more granular list; the granular list is redundant but harmless in this combination, never conflicting.
- **UC-4-EC3**: `SDLC_DISABLED_HOOKS` lists an id that does not correspond to any of the 3 configured hooks (e.g. a typo, or an id from a future feature not yet shipped) — `run-hook.js` simply never matches it against any real invocation; this is not an error, since the list is compared per-invocation against the currently-dispatching hook's own id, not validated as a set up front.
- **UC-4-EC4**: `SDLC_HOOK_PROFILE` is unset entirely (the common case — no environment configuration at all) — behaves identically to `SDLC_HOOK_PROFILE=standard` per FR-4.6, with all 3 hooks running normally; this is the expected, unconfigured default for the vast majority of installations.

### Data Requirements
- **Input**: `SDLC_HOOKS_ENABLED`, `SDLC_DISABLED_HOOKS`, `SDLC_HOOK_PROFILE` from the process environment at the moment each hook invocation starts
- **Output**: Exit `0` in every case; for a suppressed invocation, no handler-specific stdout content (no `additionalContext`, no accumulator write, no typecheck run) and no `systemMessage` about the suppression itself (suppression is silent by design, distinct from the fail-open `systemMessage` in UC-3)
- **Side Effects**: None from a suppressed invocation; normal per-handler side effects from any invocation not suppressed by the active controls

---

## UC-5: `session:start:spine` — Scratchpad Injection Re-Enters the Autonomous Loop at the Correct Slice

**Actor**: Hook script (`session-start-spine.js`); Claude Code; Developer (indirectly — the resumed session behaves correctly without being asked)
**Preconditions**: The project's `.claude/scratchpad.md` exists (variants below cover its absence/format/size/integrity); `session:start:spine` is not suppressed by any runtime control (UC-4)

**Trigger**: A `SessionStart` event fires for any `source` value (`startup`, `resume`, `clear`, `compact`) — the hook's behavior does not vary by `source`

### Primary Flow (Happy Path — Mid-Feature Scratchpad)
1. `.claude/scratchpad.md` contains, in the project's standard wave-grouped format: `## Feature: Hook Infrastructure and Non-Blocking Hooks`, `## Branch: feat/hook-infrastructure`, a `## Plan` section with `### Wave 3 [IN PROGRESS]` containing `- [x] Slice 5: ... — <hash>` and further slices, across a `## Plan` totaling 9 slices spread over its waves.
2. A `SessionStart` event fires (the developer resumed a compacted session, or reopened the project).
3. `session-start-spine.js` reads `.claude/scratchpad.md` and extracts the feature name, branch, the currently in-progress wave number, and the current slice's position (slice 5 of 9 total slices across the plan).
4. The handler builds an `additionalContext` string containing all four values (feature name, branch, wave number, slice position) — e.g. naming "Hook Infrastructure and Non-Blocking Hooks", "feat/hook-infrastructure", "Wave 3", and "Slice 5 of 9".
5. `run-hook.js` exits `0` with `hookSpecificOutput.additionalContext` set to this string.
6. The resumed session's context now contains the injected state; the agent re-enters the autonomous loop at Wave 3 / Slice 5 of 9 without asking the developer what the current state is (FR-5.7).

**Postconditions**: `additionalContext` contains the feature name, branch, wave number, and slice position as substrings — verifiable by a fixture test comparing the hook's stdout against the scratchpad fixture's known values (AC-4).

### Alternative Flows
- **UC-5-A1: Legacy flat-format scratchpad with no wave headings at all**
  1. `.claude/scratchpad.md` predates the wave-grouped convention entirely — it has `## Feature`, `## Branch`, and a `## Plan` section containing a flat numbered list (e.g. `1. [x] Slice 1: ... — <hash>`, `2. [ ] Slice 2: ...`) with no `### Wave N` heading of any kind, not even the single-wave `### Wave 1 (sequential)` fallback the current scratchpad convention specifies.
  2. `session-start-spine.js` still extracts feature name and branch successfully (those fields are format-independent).
  3. No wave number can be extracted, since none exists in the source. The handler injects the feature name, branch, and current slice position (e.g. "Slice 2") into `additionalContext`, and either omits the wave field entirely or marks it explicitly as unavailable (e.g. "wave: n/a — legacy scratchpad format") — either representation is acceptable, but a fabricated or guessed wave number is not.
  4. The handler does not throw and does not fail open (this is a supported format variation, not malformed input) — exit `0`, `additionalContext` present, feature/branch/slice fields populated.
- **UC-5-A2: Session resumes mid-compaction (`source: "compact"`)** — behaves identically to a fresh `startup`/`resume`; FR-5.7's guarantee explicitly covers "resumed or compacted," and this hook does not branch on `source` at all.

### Error Flows
- **UC-5-E1: `.claude/scratchpad.md` content is genuinely unreadable** (e.g. invalid encoding causing the file read itself to throw, not merely an unexpected structure) — this is UC-3-E1's fail-open contract, not a scratchpad-specific no-op: `run-hook.js` catches the exception, exits `0`, emits a `systemMessage` naming `session:start:spine` and reason `exception`, and delivers no `additionalContext` for this session start. This is distinct from UC-5-EC1 (file simply absent, which is silent and not an error) — the distinction matters for QA, since one path emits a visible message and the other emits nothing.

### Edge Cases
- **UC-5-EC1: No `.claude/scratchpad.md` file at all (FR-5.3, AC-11)**
  1. The project has no scratchpad — a brand-new project, or one that has never run the pipeline.
  2. `session-start-spine.js` finds the file absent, no-ops with respect to scratchpad injection: no `additionalContext` from this source, no error, no `systemMessage`.
  3. `run-hook.js` exits `0` with an empty or absent `hookSpecificOutput.additionalContext`.
  4. **Mechanically checkable outcome**: no `additionalContext` field is present in stdout (or it is empty); no side effect of any kind; the session proceeds unaffected by this hook's presence, exactly as if the hook were not configured (FR-5.3's explicit requirement, verified by AC-11's dedicated fixture test).
- **UC-5-EC2: Scratchpad content would produce `additionalContext` exceeding `SDLC_SESSION_CONTEXT_MAX_CHARS` (default `4000`, FR-5.2)**
  1. `.claude/scratchpad.md` has grown very large (e.g. a long `## Completed` history not yet archived, or an unusually verbose `## Plan`).
  2. `session-start-spine.js` builds the injection text and finds it exceeds the configured cap.
  3. The handler truncates the text to the cap rather than omitting the injection entirely — the developer still gets partial, useful context (at minimum, the feature/branch/wave/slice fields, which are prioritized) rather than nothing.
  4. **Mechanically checkable outcome**: `additionalContext`'s length is ≤ `SDLC_SESSION_CONTEXT_MAX_CHARS` (or the custom value if the environment variable is overridden); the string is non-empty and is a truncation of the source content (e.g. ends with an explicit truncation marker, or is verifiably a prefix of the untruncated text) — never an empty string and never a thrown exception due to size alone.
- **UC-5-EC3: Scratchpad is present and readable but structurally malformed** (e.g. missing the `## Feature:` line entirely, or a `## Plan` section with no recognizable list items) — the handler performs best-effort extraction: it injects whatever fields it can find (e.g. branch only, if feature is missing) rather than throwing on a missing-but-expected section; this is a normal handler code path (graceful degradation), not the UC-3-E1 exception path, provided the read itself succeeds — the two must be tested as distinct cases.

### Data Requirements
- **Input**: `.claude/scratchpad.md`'s raw content (when present); `SDLC_SESSION_CONTEXT_MAX_CHARS` from the environment (default `4000`)
- **Output**: `hookSpecificOutput.additionalContext` containing feature name, branch, wave, and slice position when extractable, capped at the configured character limit; absent/empty when no scratchpad exists
- **Side Effects**: None — this hook only reads `.claude/scratchpad.md`, never writes it (writing it remains the orchestrator-only rule per `src/rules/scratchpad.md`, unaffected by this feature)

---

## UC-6: `session:start:spine` — Harness Drift Check Against the Install Receipt

**Actor**: Hook script (`session-start-spine.js`); Developer
**Preconditions**: `.claude-plugin/plugin.json`'s `version` field is readable by the hook at `CLAUDE_PLUGIN_ROOT`; `~/.claude/.sdlc-receipt` may or may not exist, per whichever of `install.sh`'s outcomes applies on this machine (see `plugin-repackaging_use_cases.md` UC-1/UC-2/UC-9 for how the receipt does or doesn't come to exist)

**Trigger**: A `SessionStart` event fires (the same event that triggers UC-5's scratchpad injection — this is the second responsibility of the same hook, per FR-5.4)

### Primary Flow (Version Mismatch — Reported, AC-12)
1. `~/.claude/.sdlc-receipt` exists; line 1 reads `4.0.0` (the version `install.sh` recorded at its most recent run on this machine).
2. `.claude-plugin/plugin.json`'s `version` field reads `4.1.0` (the plugin has since been upgraded without a matching `install.sh` re-run).
3. `session-start-spine.js` reads both values and compares them.
4. The values differ.
5. The hook reports the mismatch via `systemMessage` and/or `hookSpecificOutput.additionalContext` (FR-5.4 permits either; a test asserts the drift note's text appears in at least one of the two fields) — e.g. "Harness version drift: installed 4.0.0 (~/.claude/.sdlc-receipt) vs plugin 4.1.0 (plugin.json) — run `bash install.sh` to update."
6. `run-hook.js` exits `0`; the session proceeds, drift report visible to the developer.

**Postconditions**: The drift report is present and names both the installed and plugin version values and the `bash install.sh` remedy — verifiable by a dedicated fixture test (AC-12).

### Alternative Flows
- **UC-6-A1: Versions match — silent (FR-5.4's implicit converse, AC-12)**
  1. `~/.claude/.sdlc-receipt` line 1 reads `4.1.0`; `plugin.json`'s `version` field also reads `4.1.0`.
  2. `session-start-spine.js` compares them and finds them identical.
  3. No drift report is emitted — no `systemMessage`, no drift-related `additionalContext` — this is silent, not merely "not alarming."
  4. **Mechanically checkable outcome**: stdout contains no drift-related text of any kind; only UC-5's scratchpad-derived `additionalContext` (if any) is present.

### Error Flows
- **UC-6-E1: `~/.claude/.sdlc-receipt` is absent (FR-5.5)**
  1. This machine never ran `install.sh` (a plugin-only trial install — the exact scenario `plugin-repackaging_use_cases.md` UC-9 documents) or the receipt was manually deleted.
  2. `session-start-spine.js` checks for the receipt file and finds it does not exist.
  3. The drift check no-ops silently — no warning, no error, and critically **no false mismatch is reported** on a machine where the memory layer was simply never installed via `install.sh`.
  4. **Mechanically checkable outcome**: no drift-related text in stdout; no non-zero exit; no distinction in observable behavior between "receipt absent" and "receipt present and matching" (UC-6-A1) — both are silent, by design, even though their underlying cause differs.

### Edge Cases
- **UC-6-EC1**: `~/.claude/.sdlc-receipt` exists but its first line is malformed (empty, or not a parseable version string — see `plugin-repackaging_use_cases.md` UC-5-E3 for the `install.sh`-side analog of a malformed receipt). The drift check treats an unparseable version line the same as UC-3-E1's fail-open path if reading/parsing throws (exit `0`, `systemMessage` reason `exception`), or, if the handler defensively checks the value's shape before comparing, as equivalent to UC-6-E1 (no receipt to trust, no false mismatch reported) — either is acceptable, but asserting a mismatch against an unparseable value is not, since that risks a false-positive drift report from garbage input.
- **UC-6-EC2**: `.claude-plugin/plugin.json` itself is unreadable or missing its `version` field from `CLAUDE_PLUGIN_ROOT` at the moment the hook runs (a corrupted or partial plugin installation). Since the hook cannot determine the plugin's own version in this case, it cannot perform a meaningful comparison; it MUST fail open (UC-3-E1's contract) rather than report a spurious mismatch or crash the invocation with a non-zero exit.
- **UC-6-EC3**: This check runs on the same `SessionStart` invocation as UC-5's scratchpad injection — both responsibilities live in one handler and one hook id. A drift report and a scratchpad-derived `additionalContext` can both be present in the same invocation's stdout simultaneously; the two are independent and neither suppresses the other.

### Data Requirements
- **Input**: `~/.claude/.sdlc-receipt` line 1 (installed version), when present; `.claude-plugin/plugin.json`'s `version` field
- **Output**: A drift report (via `systemMessage` and/or `additionalContext`) naming both version values and `bash install.sh` as the remedy, only when both values are present and differ; silence in every other case (match, or receipt absent)
- **Side Effects**: None — this is a pure read/compare; no file is written by the drift check

---

## UC-7: `post:edit:accumulate` → `stop:typecheck-format` — Batched Quality Checks Run Once Per Response

**Actor**: Hook script (`post-edit-accumulate.js`, `stop-typecheck-format.js`); Developer
**Preconditions**: The project's `CLAUDE.md` declares a typecheck command (and, optionally, a format command) — the general case; the specific case where none is declared (this repo's own default) is covered separately in UC-8, per FR-6.5's explicit instruction to treat it as this hook's primary scenario, not an afterthought

**Trigger**: One assistant response edits or writes one or more files via `Edit`/`Write` tool calls, then ends (`Stop`)

### Primary Flow (Three Files Edited in One Response — Run Once, Not Three Times, FR-6.3)
1. Within a single assistant response, the agent performs three `Edit` tool calls against three different files.
2. Each `Edit` triggers a separate `PostToolUse` event; `post:edit:accumulate` fires three times, once per call, each time appending the edited file's path to a per-session accumulator file (an implementation-defined path under `.claude/`, distinct from `.claude/scratchpad.md` per FR-6.1's explicit prohibition on writing to the orchestrator's own scratchpad).
3. The accumulator now contains 3 entries (one per edited file) after the third `PostToolUse` invocation.
4. The response ends; `Stop` fires exactly once; `stop:typecheck-format` fires exactly once.
5. `stop-typecheck-format.js` reads the accumulator's 3 paths, runs the project's declared format command once, then the project's declared typecheck command once — a single invocation of each, not one per accumulated path (FR-6.2, FR-6.3) — then clears the accumulator.
6. Both commands succeed; `run-hook.js` exits `0` with a `systemMessage` summarizing the pass result (or no message at all, if a clean pass is treated as silent — either is acceptable as long as no block occurs).

**Postconditions**: The format and typecheck commands were each invoked exactly once for this response, regardless of the 3 files touched; the accumulator is empty after `Stop` completes; the response's completion is never delayed or blocked by this hook.

### Alternative Flows
- **UC-7-A1: Zero files edited in the response — Stop hook does nothing**
  1. The response performs no `Edit`/`Write` tool calls at all (e.g. a read-only analysis response).
  2. `post:edit:accumulate` never fires — there is no matching `PostToolUse` event to trigger it, not merely a no-op invocation.
  3. `Stop` still fires (it always does, once per response). `stop-typecheck-format.js` finds the accumulator empty or absent.
  4. The handler runs neither the format nor the typecheck command — there is nothing accumulated to check.
  5. **Mechanically checkable outcome**: exit `0`; the format/typecheck commands are never invoked in this run (verifiable via a spy/mock command counter of `0`), distinct from UC-8's "commands are undeclared" no-op, since here commands ARE declared but there is simply nothing to run them against.

### Error Flows
- **UC-7-E1: The project's declared typecheck command exists but fails (reports type errors, or exits non-zero)**
  1. `stop-typecheck-format.js` runs the declared typecheck command against the 3 accumulated files' project.
  2. The command exits non-zero / reports errors.
  3. The handler captures the failure output and reports it via `systemMessage` (e.g. "Typecheck failed: 3 errors — see output for details").
  4. `run-hook.js` still exits `0` and does not block the `Stop` event (FR-6.6) — the failure is surfaced, never enforced.
  5. **Mechanically checkable outcome**: exit code `0` regardless of the underlying typecheck command's own exit code; `systemMessage` (or equivalent) contains a failure indicator; the response completes normally, not held open.

### Edge Cases
- **UC-7-EC1: The accumulator file is missing at `Stop` time** (e.g. deleted between the last `PostToolUse` and `Stop` by an unrelated process, or never created because this is the very first edit of a fresh session and file creation raced with a concurrent read) — `stop-typecheck-format.js` treats this identically to UC-7-A1 (zero files, no-op) rather than throwing; exit `0`, no command invoked.
- **UC-7-EC2: The accumulator file is present but corrupt** (e.g. truncated mid-write, or contains unrecognized/non-path content due to a race between two rapid `PostToolUse` invocations) — the handler either skips unrecognized lines and processes whatever valid paths remain, or, if it cannot parse the file at all, falls back to UC-3-E1's fail-open contract (exit `0`, `systemMessage` reason `exception`). Either recovery strategy is acceptable; the single non-negotiable, mechanically-checkable invariant across both is exit `0` and the `Stop` event never blocked.
- **UC-7-EC3: The same file is edited twice within one response** (two separate `Edit` calls against the same path) — the accumulator may contain the path twice; `stop-typecheck-format.js` running the project's typecheck/format commands once for the whole project (not per-file) makes de-duplication immaterial to the observable outcome — the commands still run exactly once regardless of duplicate entries.

### Data Requirements
- **Input**: The accumulator file's content at `Stop` time; the project's declared format/typecheck commands (from `CLAUDE.md`)
- **Output**: `systemMessage` summarizing the batched run's outcome (pass, fail-with-details, or no-op); the accumulator cleared after processing
- **Side Effects**: The project's format and typecheck commands are executed on the developer's machine (their own side effects — e.g. reformatted files on disk — are the project's own commands' behavior, not this hook's); the accumulator file is created, appended to, read, and cleared

---

## UC-8: `stop:typecheck-format` — No Typecheck Command Declared (This Repo's Default, Non-Blocking No-Op)

Per FR-6.5, this is this repository's own everyday behavior — `claude-code-sdlc` has no `package.json` and declares no typecheck command in its `CLAUDE.md` — and FR-6.5/AC-5 require this be treated as the **primary** scenario for `stop:typecheck-format`, not a corner case appended after the general mechanism.

**Actor**: Hook script (`stop-typecheck-format.js`); Developer
**Preconditions**: The project's `CLAUDE.md` (or the harness's own `src/claude.md`, once installed as `~/.claude/claude.md`) declares no typecheck command — this repo's actual, permanent state, not a contrived fixture

**Trigger**: An assistant response ends (`Stop`), regardless of whether any files were edited

### Primary Flow (This Repo's Own Configuration, AC-5)
1. A response in the `claude-code-sdlc` repo itself edits one or more markdown/shell/CI-JavaScript files (e.g. during an `/implement-slice` run against this very feature).
2. `post:edit:accumulate` records each edited path normally, exactly as in UC-7 — the accumulation mechanism itself is unaffected by whether a typecheck command exists.
3. The response ends; `Stop` fires; `stop-typecheck-format.js` reads the accumulated paths and then checks the project's `CLAUDE.md` for a declared typecheck command.
4. No typecheck command is declared (no `package.json`, no "Commands" section entry for typecheck) — this repo's permanent, documented state.
5. `stop-typecheck-format.js` does not attempt to run any command; it no-ops with a visible note: `run-hook.js` writes a `systemMessage` stating that no typecheck command is configured (FR-6.4).
6. `run-hook.js` exits `0`; the `Stop` event is not blocked; the response completes normally.

**Postconditions**: No typecheck or format command was ever invoked; a `systemMessage` explicitly states no typecheck command is configured; exit code `0`; `Stop` proceeds unblocked (AC-5).

### Alternative Flows
- **UC-8-A1: Project has a `package.json` but its `CLAUDE.md` still does not declare a typecheck command** — the discovery source is the project's `CLAUDE.md` text (its "Commands" section), not automatic inference from `package.json` scripts; a project with typecheck tooling installed but undocumented in `CLAUDE.md` is treated identically to having no typecheck tooling at all — same no-op, same visible `systemMessage`.
- **UC-8-A2: No format command declared either** — by the same logic FR-6.4 states for typecheck, an undeclared format command is skipped identically; this repo declares neither, so both are skipped in the same no-op pass, producing one combined (or two individually-worded) no-op note(s), never a partial run of just one of the two.

### Error Flows
- **UC-8-E1: `CLAUDE.md` does not exist at all in the project** (an even more minimal state than "exists but declares nothing") — treated identically to "declares no typecheck command": the handler cannot find a command to run either way, so the outcome (no-op, visible `systemMessage`, exit `0`) does not differ based on whether the file is entirely absent versus present-without-a-declaration.

### Edge Cases
- **UC-8-EC1**: `CLAUDE.md` declares a typecheck command whose underlying tool is not installed on this machine (e.g. `npm run typecheck` declared, but `npm`/`node_modules` absent) — this is NOT this UC's scenario; a declared-but-failing-to-execute command is UC-7-E1's territory (the command exists as configuration but fails when run), not "no command declared." The distinction matters because the two produce different `systemMessage` wording (a configuration-absence note here, versus a failure report there) and QA test cases must probe both, not conflate them.
- **UC-8-EC2**: The very first `Stop` event of a session in a project with no typecheck command AND zero files edited — both UC-7-A1's "nothing accumulated" and this UC's "nothing configured" conditions hold simultaneously; the handler still exits `0` cleanly, and whichever no-op note (or the absence of any note, since nothing needs reporting when there's also nothing to check) it emits does not itself constitute an error.

### Data Requirements
- **Input**: The project's `CLAUDE.md` content (checked for a declared typecheck/format command); the accumulator's content, if any
- **Output**: A visible `systemMessage` stating no typecheck command is configured; exit code `0`
- **Side Effects**: None — no command of any kind is executed on the developer's machine in this scenario

---

## UC-9: Permissions Defaults — `templates/settings.json` Allow/Deny Lists, and the Double-Fire Hazard

**Actor**: Developer (scaffolds a new project from `templates/settings.json`, or works within an already-scaffolded one); Claude Code (evaluates each command against the permissions lists before prompting)
**Preconditions**: A project's `.claude/settings.json` was scaffolded from `templates/settings.json`, which now declares both a non-empty `permissions.deny` list (FR-7.1) and an expanded `permissions.allow` list beyond its original 3 entries (FR-7.2), while preserving those original 3 entries unchanged (FR-7.4)

**Trigger**: The pipeline (or the developer directly) issues a shell command, file edit, or git operation during an unattended run

### Primary Flow (Routine Pipeline Commands Proceed Without Prompting)
1. During an unattended `/develop-feature` run, the pipeline issues the project's own test, build, and typecheck commands, reads and writes files within the project's own working tree, and commits with `git commit`.
2. Each such command matches an entry in `permissions.allow` (the original 3 — `Bash(git commit*)`, `Edit(.claude/scratchpad.md)`, `Write(.claude/scratchpad.md)` — plus the FR-7.2 expansion covering the pipeline's own routine commands).
3. None of these commands stall on a permission prompt — there is no one at the keyboard to answer it, so a stall here is, in practice, a stopped run (the exact autonomy failure FR-7 exists to close).
4. The run proceeds to merge-ready without a single permission interruption for any command the pipeline's own documented behavior generates.

**Postconditions**: No routine, documented pipeline command stalls on a permission prompt during an unattended run.

### Alternative Flows
- **UC-9-A1: A command matches neither `allow` nor `deny`** — Claude Code's default prompt behavior applies unchanged: the developer (if present) is asked, exactly as before this feature existed. FR-7.1/FR-7.2 are not required to cover every possible command, only the routine ones the pipeline itself issues (FR-7.2's explicit scope) and the specific destructive/exfiltration shapes named in FR-7.1 — this is a bounded expansion, not a blanket allow-everything change.
- **UC-9-A2: The 3 pre-existing `permissions.allow` entries are verified present and unchanged after the FR-7.2 expansion (FR-7.4, AC-7)** — `Bash(git commit*)`, `Edit(.claude/scratchpad.md)`, `Write(.claude/scratchpad.md)` all remain, verifiable by inspecting `templates/settings.json` post-scaffold and confirming their literal presence alongside the newly added entries.

### Error Flows
- **UC-9-E1 (hazard, must never occur — FR-7.3, AC-6): `hooks/hooks.json`'s contents are copied into `templates/settings.json` or a project's `.claude/settings.json`**
  1. A well-intentioned maintainer or scaffolding change pastes the plugin's hook configuration (or a `hooks` key referencing the same 3 ids) directly into `settings.json`, believing this "enables" the hooks in a specific project.
  2. Plugin hooks already auto-load directly from the plugin's own `hooks/hooks.json` the moment the plugin is installed (FR-1.1) — this copy registers the same 3 hook ids a second, independent time.
  3. Every subsequent matching lifecycle event now spawns each hook TWICE: `session:start:spine` fires twice at session start (potentially duplicating the drift report and/or scratchpad `additionalContext`), `post:edit:accumulate` fires twice per `Edit`/`Write` call (each edited path recorded twice in the accumulator), `stop:typecheck-format` fires twice per response (the format and typecheck commands each run twice for the same response, doubling FR-6.3's "exactly once" guarantee into "exactly twice").
  4. Measured per-tool-call latency (UC-10) doubles on top of whatever baseline this feature's 3 hooks already add, compounding Risk 2's pre-existing 14-entry baseline further.
  5. **Detection**: inspect `templates/settings.json` (or any project's `.claude/settings.json`) for the presence of a `hooks` key at all — its mere presence is itself the defect signature, independent of its content, since FR-7.3 requires zero `hooks` keys ever appear there (AC-6: "confirming it contains a `permissions` object only, no `hooks` key of any kind").
  6. **Remedy**: remove the `hooks` key entirely from `settings.json`; the plugin's own `hooks/hooks.json` remains the sole, sufficient source of hook registration — no project-level or user-level `settings.json` copy is ever required or permitted.

### Edge Cases
- **UC-9-EC1**: A command is destructive-shaped but scoped entirely inside the project's own working tree (e.g. `rm -rf ./node_modules`) versus the same shape targeting outside it (e.g. `rm -rf /`, or a path traversal out of the project root) — FR-7.1's deny list is scoped to "outside a project's own working tree"; an in-tree destructive command is not automatically denied by this feature's additions, since destroying and rebuilding a project's own generated artifacts (like `node_modules`) is a normal, low-risk operation the pipeline may need to perform, unlike a deletion reaching outside the project.
- **UC-9-EC2**: An exfiltration-shaped command uses an unusual or obfuscated form (e.g. base64-encoding a payload before piping to an external endpoint) that the literal deny-list pattern does not match verbatim — this is a known limitation of pattern-based `permissions.deny` matching, not a defect specific to this feature; FR-7.1 requires covering the named shapes "at minimum," not achieving exhaustive obfuscation-proof coverage.
- **UC-9-EC3**: A forced or history-rewriting git operation (e.g. `git push --force`) is issued against a local-only branch with no shared remote, versus the same command against a shared branch — FR-7.1 names "shared branches" as the concern; a deny-list implementation that cannot distinguish local-only from shared branches at the pattern-matching level would need to deny the command shape unconditionally (erring toward safety) rather than attempting branch-aware logic beyond simple pattern matching, since Claude Code's permission matching operates on the command string, not repository state.

### Data Requirements
- **Input**: `templates/settings.json`'s `permissions.allow`/`permissions.deny` lists; the command string Claude Code is about to execute
- **Output**: Allow (no prompt), deny (refused outright), or default prompt behavior, depending on which list (if either) matches
- **Side Effects**: None from the permission check itself; UC-9-E1's hazard scenario's side effect is duplicated hook execution, not a permissions-list side effect per se

---

## UC-10: Hook Latency — Measuring Per-Tool-Call Overhead Against the Existing 14-Entry Baseline

**Actor**: Harness Maintainer (implementing AC-10); Developer (experiences the cumulative effect over a long unattended run)
**Preconditions**: The reference machine already has 14 hook entries registered in `~/.claude/settings.json` (several with empty matchers on `PreToolUse`/`PostToolUse`, per Risk 2) — this feature's 3 hooks stack on top of that pre-existing baseline, not on a clean machine

**Trigger**: A measurement pass is run as part of this feature's implementation record (AC-10), comparing a fixed sequence of tool calls with hooks enabled versus `SDLC_HOOKS_ENABLED=0`

### Primary Flow (Isolating This Feature's Contribution From the Pre-Existing Baseline)
1. A fixed sequence of tool calls is defined for repeatable measurement — e.g. N `Edit` calls against a scratch file, since `post:edit:accumulate` is the only one of the 3 hooks that fires per tool call (`session:start:spine` fires once per session; `stop:typecheck-format` fires once per response — neither scales with tool-call count, so their overhead must be measured and reported separately, not folded into a "per tool call" figure).
2. The sequence is run once with hooks enabled (default configuration, `SDLC_HOOK_PROFILE=standard`), and wall-clock time is recorded per `Edit` call.
3. The identical sequence is run again with `SDLC_HOOKS_ENABLED=0` set, isolating this feature's 3 hooks out of the equation while the pre-existing 14-entry baseline remains active in both runs.
4. The difference between the two runs' average per-call time is this feature's own added latency, isolated from the pre-existing baseline's own (unrelated) overhead.
5. Multiple trials are averaged to reduce noise from OS scheduling jitter and the pre-existing 14 entries' own variance, rather than relying on a single sample.
6. The measured delta (per-`Edit`-call overhead from `post:edit:accumulate`; separately, one-time overhead from `session:start:spine` at session start and from `stop:typecheck-format` at response end) is reported in the implementation record, not merely asserted to be negligible (AC-10's explicit requirement).

**Postconditions**: A reported, measured wall-clock number (not an assertion) exists for this feature's added overhead, decomposed into per-tool-call (`post:edit:accumulate`) and per-event (`session:start:spine`, `stop:typecheck-format`) components.

### Alternative Flows
- **UC-10-A1: Measuring under `SDLC_HOOK_PROFILE=minimal` versus `strict`** — if the implementation's profile assignments (UC-4-A3) exclude some of the 3 hooks from `minimal`, the measured overhead under `minimal` is lower than under `standard`/`strict`; each profile's overhead is reported separately rather than assuming a single number applies across all three.

### Error Flows / Unacceptable-Threshold Scenario
- **UC-10-E1: Measured added latency exceeds an acceptable bound (recommended threshold, not a hard PRD-stated number — AC-10 requires measurement and reporting, not a specific pass/fail cutoff)**
  1. The measured average added latency per `Edit`/`Write` tool call, attributable to `post:edit:accumulate` alone and isolated from the pre-existing 14-entry baseline (per the primary flow's methodology), exceeds a recommended **150ms per call**, OR the total added wall-clock time across a typical implementation slice touching 10–20 files (a realistic `/implement-slice` scope) attributable to this feature's 3 hooks exceeds a recommended **2 seconds** cumulative.
  2. This is flagged as a latency regression requiring investigation — the likely dominant cost is Node process cold-start overhead incurred on every single `post:edit:accumulate` invocation (one fresh `node` process per `Edit`/`Write` call), not the handler's own trivial file-append logic.
  3. **This threshold is this document's own recommended acceptance bound for QA to encode as a concrete test assertion — the PRD's AC-10 itself only mandates that the number be measured and reported, not that it fall under any specific figure.** QA test cases derived from this use case should treat the 150ms/2s figures as the default assertion bounds unless the implementation record's actual measurement and the architect's review revise them.
  4. Regardless of the measured number, no scenario in this UC ever blocks a tool call or a response — latency is a reported quality metric, not a gate this feature enforces at runtime; an unacceptable measurement is addressed in a follow-up optimization (e.g. a persistent hook process, or reducing per-call spawn overhead), not by this feature refusing to proceed.

### Edge Cases
- **UC-10-EC1**: The pre-existing 14-entry baseline's own run-to-run variance is larger than the delta this feature's 3 hooks add, making a single-trial measurement unreliable — the primary flow's requirement to average multiple trials (step 5) exists specifically to make this feature's contribution distinguishable from that pre-existing noise; a measurement methodology using only one trial per configuration is insufficient and should be flagged as such in review.
- **UC-10-EC2**: `session:start:spine`'s one-time per-session cost (including its scratchpad read and drift-check file reads) is measured separately from `post:edit:accumulate`'s per-call cost — conflating the two into a single "average per tool call" figure would understate the per-call number (session start amortizes over the whole session) and is explicitly why the primary flow decomposes the measurement by hook rather than reporting one blended average.
- **UC-10-EC3**: A machine with zero pre-existing hook entries (a clean install, unlike the documented reference machine) would show a different absolute latency profile than Risk 2's reference machine — the measurement methodology (enabled vs. `SDLC_HOOKS_ENABLED=0` diff) is designed to be machine-independent in what it isolates (this feature's own contribution), even though the absolute numbers on any given machine will vary with its own pre-existing hook count.

### Data Requirements
- **Input**: A fixed, repeatable sequence of tool calls; wall-clock timestamps around each call; the machine's pre-existing `~/.claude/settings.json` hook count (documented as 14 on the reference machine, per Risk 2)
- **Output**: A reported, decomposed latency figure (per-tool-call for `post:edit:accumulate`; per-event for `session:start:spine` and `stop:typecheck-format`) in the implementation record; a pass/fail judgment against the recommended thresholds in UC-10-E1
- **Side Effects**: None to the codebase — this is a measurement exercise; the scratch files/commands used for timing are test scaffolding, not shipped assets
