# Test Cases: Blocking Guards

> Based on [PRD](../PRD.md) — Section 8 and [Use Cases](../use-cases/blocking-guards_use_cases.md)

**Status note (read before anything else):** PRD Section 8 was amended after the use-case document was written. It now ships **six** blocking guards, not seven — `pre:edit:gateguard` (UC-13 in the use-case document) is **deferred** to its own later feature (Design Decision 9, PRD 8.10 Risk 4) and is explicitly out of scope for this test-case document. It is mapped in the traceability table at the end as **DEFERRED**, with a small confirmation suite (Section 8 below) proving the deferral actually holds — i.e. that no guard handler, hook registration, or hook-count regression smuggles it back in. Every FR/AC citation in this document uses the current, post-amendment PRD numbering (FR-1 through FR-11, AC-1 through AC-20); where a UC's own prose cites a stale AC number from before the amendment (e.g. UC-16's "AC-13"/"AC-14", UC-17's "AC-16"), this document cites the current equivalent instead and does not repeat the stale number.

**System context:** Identical in kind to `hook-infrastructure_test_cases.md` — no UI, no server, no database. What is new here is that six of this harness's hooks can now say no. Every guard is a `PreToolUse`/`PostToolUse`/`Stop` handler dispatched through the same shared wrapper, `hooks/lib/run-hook.js`, which this feature extends with a deny-serialization channel (FR-1.6–FR-1.10) it did not previously have.

**Testing convention (mandatory for every test case below, inherited from `hook-infrastructure_test_cases.md` and extended for blocking semantics):** every test case constructs a crafted stdin JSON fixture matching Claude Code's hook I/O contract, pipes it into the hook under test via `tests/hooks/harness.js`'s `runHook(hookId, input, env, opts)` — which spawns `node hooks/lib/run-hook.js --hook <id>` exactly as Claude Code would, never `require()`s a handler in-process — and asserts on the returned `{ code, stdout, json }`: the process **exit code** and the **shape/content of the parsed stdout JSON envelope**, specifically `hookSpecificOutput.permissionDecision` / `permissionDecisionReason` for `PreToolUse` guards and `decision` / `reason` for the one `Stop` guard. Fixtures live under `tests/fixtures/hooks/guards/`, mirroring `tests/fixtures/hooks/handlers/`'s existing convention; a sandboxed scratch directory (`$SANDBOX`) supplies `cwd` for every test needing a controlled working tree (`.claude/scratchpad.md`, `.claude/tmp/`, `docs/PRD.md`, config files, `CHANGELOG.md`) — no test case may point at the developer's real project.

Three categories of test case appear below, extending `hook-infrastructure_test_cases.md`'s two:
1. **Executable checks** (the large majority) — real exit codes and stdout JSON assertions driven through `run-hook.js`, exactly as above.
2. **Content checks** — static source/config assertions (e.g. the narrowed CI sweep's file list, the `FR-9.7` no-self-granted-exception source scan) that cannot be runtime-driven because they assert the *absence* of a code shape, not the *presence* of working behavior.
3. **Backstop (process) checks** — new to this document. Each guard names a specific downstream `/merge-ready` gate or finalization step (`skills/merge-ready/SKILL.md`) that independently re-checks the same invariant if the guard degrades. `/merge-ready`'s gates are an agent-driven skill, not code with its own unit-test suite in this repository, so these test cases are content checks against `skills/merge-ready/SKILL.md`'s own gate criteria text (confirming the named gate's stated check still covers the invariant) rather than a live end-to-end merge-ready run — the one live, end-to-end exercise of the whole guard-plus-backstop system is Section 14's autonomy regression test.

---

## 1. The Wrapper Deny Channel — Central Mechanism, Highest Priority (FR-1.6–FR-1.10, FR-10.2, AC-14, AC-15)

This is the most important cluster in this document. The architecture review that produced this section's PRD amendment found that Section 7's shipped `finish()` whitelists exactly two result fields (`systemMessage`, `additionalContext`) and silently drops everything else — under that contract, a guard handler that tried to return a deny would have it discarded and the call silently allowed: **a guard that looks installed and never fires**, indistinguishable from a passing test at every level except the one that matters. FR-1.6–FR-1.10 fix this by adding an event-aware deny-serialization channel to the wrapper itself. Every test case in this section exists to catch a regression of exactly that swallowed-deny defect, and per FR-10.2's own explicit instruction, **none of them may be a source grep** — "a static grep cannot detect a deny the wrapper silently swallows; only driving a real call through `run-hook.js` and inspecting its actual stdout can." A future refactor could pass a source-grep positive control (the string `permissionDecision` still appears somewhere in the file) while the actual code path that constructs it is unreachable, off-by-one on the event-name check, or dead. Only a runtime assertion catches that.

### 1.1 Positive Control — A Deliberate Deny Actually Reaches stdout, Per Guard (FR-10.2(a), AC-14)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.1.1 | UC-1 Primary Flow, UC-16-A1 (superseded by FR-10.2(a)) | `pre:bash:git-guard` denying a `git commit` on `main` actually reaches stdout as a real decision | Scratch git repo checked out on `main`; stdin fixture for `Bash` `git commit -m "feat(core): x"` | Invoke `runHook('pre:bash:git-guard', input, env)` | Exit `0`; `json.hookSpecificOutput.hookEventName === "PreToolUse"`; `json.hookSpecificOutput.permissionDecision === "deny"`; `permissionDecisionReason` is a non-empty string containing `main` |
| 1.1.2 | UC-7 Primary Flow, UC-16-A1 | `pre:write:shrink-guard` denying a gutting `Write` to `docs/PRD.md` actually reaches stdout | Scratch project with `docs/PRD.md` at 1600 lines; `Write` fixture with 200-line content | Invoke `runHook('pre:write:shrink-guard', input, env)` | Exit `0`; `hookSpecificOutput.permissionDecision === "deny"`; reason contains `1600`, `200`, and the computed threshold `640` |
| 1.1.3 | UC-8 Primary Flow, UC-16-A1 | `pre:edit:read-guard`'s `PreToolUse` half denying an `Edit` to an unread file actually reaches stdout | Scratch project; existing file never `Read` this `session_id`; `Edit` fixture | Invoke `runHook('pre:edit:read-guard', input, env)` with `hook_event_name: "PreToolUse"` | Exit `0`; `hookSpecificOutput.permissionDecision === "deny"`; reason contains the target file path |
| 1.1.4 | UC-9 Primary Flow, UC-16-A1 | `pre:edit:config-protection` denying `strict: true → false` actually reaches stdout | Scratch `tsconfig.json` with `"strict": true`; `Edit` fixture flipping it to `false` | Invoke `runHook('pre:edit:config-protection', input, env)` | Exit `0`; `hookSpecificOutput.permissionDecision === "deny"`; reason contains `strict`, `true`, `false` |
| 1.1.5 | UC-11 Primary Flow A, UC-16-A1 | `pre:agent:isolation-guard` (FR-6.2 branch) denying a subagent `Write` to `.claude/scratchpad.md` actually reaches stdout | Only runnable if the FR-6.1 spike's recorded finding is the FR-6.2 branch; stdin fixture carrying the confirmed subagent indicator, targeting `.claude/scratchpad.md` | Invoke `runHook('pre:agent:isolation-guard', input, env)` | Exit `0`; `hookSpecificOutput.permissionDecision === "deny"`; reason names the target file and "orchestrator". **If the spike instead lands on the FR-6.3 branch, this test case does not apply — see 6.2 for the branch actually shipped.** |
| 1.1.6 | UC-12 Primary Flow, UC-16-A1 | `stop:changelog-guard` blocking `Stop` for a shape-defective entry actually reaches stdout | Scratch `CHANGELOG.md` with a new entry missing `**Details:**`; `Stop` fixture | Invoke `runHook('stop:changelog-guard', input, env)` | Exit `0`; **no** `hookSpecificOutput` field at all; instead top-level `json.decision === "block"` and `json.reason` is a non-empty string containing `**Details:**` — confirms the `Stop`-event serialization branch (FR-1.7), distinct in shape from the five `PreToolUse` guards above |

### 1.2 Negative Control — Malfunction Mid-Decision Produces No Decision Field, Per Guard (FR-10.2(b), UC-14, AC-14)

Each row injects a malfunction (a fixture guard-handler variant, loaded via `SDLC_HOOK_HANDLERS_DIR` pointed at `tests/fixtures/hooks/guards/handlers/`, engineered to throw synchronously at the exact line that would otherwise construct `{ deny: { reason } }`) on a call that — absent the malfunction — would have denied. This is the "fail-open means allow" property from UC-14, made runtime-testable per guard rather than asserted in the abstract. The assertion is **absence**, not merely `code === 0`: a buggy implementation could exit `0` while still smuggling a stale `"deny"` through a half-completed object (UC-14-E1), so every row parses the full JSON and checks the specific field is missing, not just that the process didn't crash.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.2.1 | UC-1-E1, UC-14 Primary Flow | `pre:bash:git-guard`'s handler throws mid-branch-resolution on a `main`-branch commit | Fixture handler for `pre:bash:git-guard` that throws when it would otherwise call `git rev-parse` | Invoke via `SDLC_HOOK_HANDLERS_DIR` pointed at the malfunctioning fixture | Exit `0`; `json.hookSpecificOutput` is either absent or, if present, has **no** `permissionDecision` key of any kind; `json.systemMessage` contains `pre:bash:git-guard` and `exception` |
| 1.2.2 | UC-7-E1, UC-14-A2 | `pre:write:shrink-guard`'s handler throws mid-line-count computation on a gutting `Write` | Fixture handler that throws while reading the curated file's current content | Invoke via the fixture handlers dir | Exit `0`; no `permissionDecision` field anywhere in `json`; `systemMessage` names the hook id and `exception` |
| 1.2.3 | UC-8-E1, UC-14 | `pre:edit:read-guard`'s `PreToolUse` half throws mid-record-check on an unread-file `Edit` | Fixture handler that throws when reading the read-tracker record | Invoke with `hook_event_name: "PreToolUse"` via the fixture handlers dir | Exit `0`; no `permissionDecision` field; `systemMessage` names the hook id and `exception` |
| 1.2.4 | UC-9-E1, UC-14 | `pre:edit:config-protection`'s handler throws mid-diff on a `strict`-flipping `Edit` | Fixture handler that throws while diffing pre/post content | Invoke via the fixture handlers dir | Exit `0`; no `permissionDecision` field; `systemMessage` names the hook id and `exception` |
| 1.2.5 | UC-11-E1, UC-14 | `pre:agent:isolation-guard`'s handler throws mid-determination on a scratchpad `Write` | Fixture handler that throws while inspecting the subagent indicator (either branch) | Invoke via the fixture handlers dir | Exit `0`; no `permissionDecision` field; `systemMessage` names the hook id and `exception` — applies identically regardless of which of the two branches (FR-6.2/FR-6.3) is shipped, since the malfunction occurs before either branch's own logic completes |
| 1.2.6 | UC-12-E4, UC-14-A1 | `stop:changelog-guard`'s handler throws mid-shape-assertion on a defective entry | Fixture handler that throws while parsing `CHANGELOG.md`'s content | Invoke via the fixture handlers dir | Exit `0`; **no** `decision` field anywhere in `json` (not merely no `hookSpecificOutput` — this guard's decision field is top-level per FR-1.7); `systemMessage` names the hook id and `exception` |
| 1.2.7 | UC-14-A2 (timeout variant) | A representative guard (`pre:bash:git-guard`) hangs past its configured timeout instead of throwing | Fixture handler that never resolves; short test-configured `SDLC_HOOK_TIMEOUT_MS` | Invoke and measure wall-clock time | Exit `0`; bounded wall-clock time; no `permissionDecision` field; `systemMessage` names `timeout` |
| 1.2.8 | UC-14-A3 (Node-too-old variant) | A representative guard (`pre:write:shrink-guard`) never reaches its own decision logic because the version gate rejects first | `SDLC_HOOK_FORCE_NODE_VERSION=16.0.0` | Invoke against a gutting-`Write` fixture that would otherwise deny | Exit `0`; no `permissionDecision` field; `systemMessage` names `node-unavailable` |
| 1.2.9 | UC-14-EC1 | A malfunction on a call that would have been an *allow* anyway is indistinguishable from a correct allow except for the `systemMessage` | `pre:bash:git-guard` fixture handler throws while evaluating a commit already on a feature branch | Invoke and inspect | Exit `0`; no `permissionDecision` field either way; `systemMessage` present (names `exception`) distinguishes this from a silently-correct allow — confirms fixture suites must inject malfunctions independent of what the "correct" answer would have been |

### 1.3 Structural Incapability — `pre:edit:read-guard`'s `PostToolUse` Half Cannot Emit a Decision (FR-1.7, FR-10.2(c), AC-15)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.3.1 | UC-14, FR-1.7 (the `PostToolUse` drop) | A deny returned under `PostToolUse` is dropped by the wrapper, proving the recorder half is structurally incapable of denying | A dedicated fixture guard-handler variant for `pre:edit:read-guard` engineered to return `{ deny: { reason: "should never surface" } }` *even under a `PostToolUse`/`Read` invocation* — i.e. the recorder half deliberately misbehaving, simulating a future dispatch bug | Invoke `runHook('pre:edit:read-guard', readStdinFixture, env)` with `hook_event_name: "PostToolUse"`, `tool_name: "Read"` | Exit `0`; stdout JSON contains **no** `permissionDecision` field and **no** `decision` field anywhere, despite the handler's own return value explicitly asking for one — proves FR-1.7's event-aware drop is a wrapper-side structural guarantee, not handler discipline |
| 1.3.2 | FR-1.7 (contrast) | The identical handler module, same `deny`-shaped return, under `PreToolUse` instead — the decision surfaces normally | Same fixture handler as 1.3.1 | Invoke with `hook_event_name: "PreToolUse"`, `tool_name: "Edit"` | Exit `0`; `hookSpecificOutput.permissionDecision === "deny"` present — confirms 1.3.1's absence is caused specifically by the event name, not by some other property of the fixture |
| 1.3.3 | FR-1.7 (exhaustive event sweep) | Every non-`PreToolUse`/non-`Stop` event name drops a `deny`, not only `PostToolUse` | Same fixture handler; stdin varied across `hook_event_name` values `SessionStart`, `PostToolUse`, and an unrecognized string `"SomeFutureEvent"` | Invoke once per event name | For all three: exit `0`; no `permissionDecision`; no `decision` — confirms the drop is "any other event name," per FR-1.7's literal text, not a `PostToolUse`-specific special case |

### 1.4 Malformed Deny Objects Are Dropped, Not Half-Emitted (FR-1.9)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.4.1 | FR-1.9, UC-14-E1 | `result.deny` is a string, not an object | Fixture handler returns `{ deny: "not-an-object" }` under `PreToolUse` | Invoke via the fixture handlers dir | Exit `0`; no `permissionDecision` field |
| 1.4.2 | FR-1.9 | `result.deny` is an object with no `reason` key at all | Fixture handler returns `{ deny: {} }` | Invoke | Exit `0`; no `permissionDecision` field |
| 1.4.3 | FR-1.9 | `result.deny.reason` is an empty string | Fixture handler returns `{ deny: { reason: "" } }` | Invoke | Exit `0`; no `permissionDecision` field |
| 1.4.4 | FR-1.9 | `result.deny.reason` is `null` | Fixture handler returns `{ deny: { reason: null } }` | Invoke | Exit `0`; no `permissionDecision` field |
| 1.4.5 | FR-1.9 (partial-emission regression) | A malformed `deny` alongside a valid `systemMessage` on the same result — only the decision half is dropped | Fixture handler returns `{ deny: { reason: "" }, systemMessage: "advisory note" }` | Invoke | Exit `0`; no `permissionDecision` field; `systemMessage` **is** present and equals the sanitized advisory text — confirms FR-1.9 drops only "everything decision-related," not the entire result object |

### 1.5 Exit Code Invariant — Always `0`, Deny Included (FR-1.10, FR-9.8)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 1.5.1 | FR-1.10, FR-9.8 | Every fixture in 1.1 (six real denies) exits `0`, never `2` | Fixtures 1.1.1–1.1.6 | Collect exit codes from all six | Every exit code is exactly `0` — a deny is carried entirely by stdout JSON shape, never by the process's own exit code |
| 1.5.2 | FR-9.8 (regression guard, content check) | No file under `hooks/` — including the six new guard handlers and the modified `run-hook.js` — ever calls `process.exit(2)` or sets `process.exitCode = 2` | Implementation complete | Grep every `.js`/`.json` file under `hooks/` for `exit(2)` / `exitCode = 2`, excluding comment lines | Zero matches anywhere — this repeats Section 7's own regression guard (`hook-infrastructure_test_cases.md` 4.1.1) but now must also hold for six new files that did not exist when that guard was first written |

---

## 2. `pre:bash:git-guard` (FR-2, UC-1 – UC-6, UC-1-B, UC-3-B)

Backstop: `merge-ready` **Gate 0 (Git Hygiene)** (FR-2.9). Deviation token: `rule-1` for the branch/`--no-verify`/bulk-add/attribution/conventional-commit checks (FR-2.2–FR-2.6); `rule-3` for the push check (FR-2.7).

### 2.1 Never Commit on `main`/`master` (UC-1)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.1.1 | UC-1 Primary Flow, AC-1 | Commit on `main` is denied | Scratch repo on `main`; `git rev-parse --abbrev-ref HEAD` resolves to `main` | `runHook('pre:bash:git-guard', {tool_name:"Bash", tool_input:{command:'git commit -m "feat(core): x"'}, cwd, ...})` | Exit `0`; `permissionDecision === "deny"`; reason contains `main` and `git checkout -b` |
| 2.1.2 | UC-1-A2 | Commit on `master` is denied identically | Scratch repo on `master` | Same command | Exit `0`; `permissionDecision === "deny"`; reason contains `master` and `git checkout -b` |
| 2.1.3 | UC-1-A1, AC-1 (allow) | **The identical command on a feature branch is not denied** — the guard's dominant, everyday path | Scratch repo on `feat/hook-infrastructure` | Same command | Exit `0`; **no** `permissionDecision` field |
| 2.1.4 | UC-1-A3 (allow, escape) | `SDLC_ALLOW_GIT_GUARD=1` bypasses the `main`-branch deny for one call | Scratch repo on `main` | Same command with `env.SDLC_ALLOW_GIT_GUARD = '1'` | Exit `0`; no `permissionDecision` field |
| 2.1.5 | UC-1-EC1 | A compound command (`cd /tmp/scratch && git commit -m "..."`) on `main` is still caught — branch resolves from stdin `cwd`, not the `cd` target | Scratch repo on `main`; `command: 'cd /tmp/scratch && git commit -m "feat(core): x"'` | Invoke | Exit `0`; `permissionDecision === "deny"`; reason contains `main` — confirms the guard is not fooled by a leading directory change |
| 2.1.6 | (allow, out-of-scope command) | `git status`, `git diff`, `git log` never match the guard's inspection set at all | Scratch repo on `main` | Invoke separately with `command: "git status"`, `"git diff"`, `"git log"` | All three: exit `0`, no `permissionDecision` field — the matcher never fires, mechanically identical to an unrelated `Bash` command |
| 2.1.7 | UC-1-EC2 (kill switch) | `SDLC_DISABLED_HOOKS=pre:bash:git-guard` suppresses the check entirely | Scratch repo on `main` | Invoke with `env.SDLC_DISABLED_HOOKS = 'pre:bash:git-guard'` | Exit `0`; no `permissionDecision`; no `systemMessage` (silent suppression, distinct from a fail-open note) |

### 2.2 No `--no-verify` (UC-2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.2.1 | UC-2 Primary Flow, AC-2 | `git commit --no-verify -m "feat(core): x"` on a feature branch is denied | Scratch repo on `feat/x` | Invoke | Exit `0`; `permissionDecision === "deny"`; reason contains `--no-verify` |
| 2.2.2 | UC-2-A1, AC-2 (allow) | The identical command without `--no-verify` is not denied | Scratch repo on `feat/x` | `command: 'git commit -m "feat(core): x"'` | Exit `0`; no `permissionDecision` field |
| 2.2.3 | UC-2-A2 (allow, escape) | `SDLC_ALLOW_GIT_GUARD=1` allows the `--no-verify` commit to proceed | Scratch repo on `feat/x` | Same command as 2.2.1 with escape set | Exit `0`; no `permissionDecision` field |
| 2.2.4 | UC-2-EC1 (allow, negative fixture) | An unrelated `-n` on a different subcommand inside the same compound command does not false-positive | `command: 'git log -n 5 && git commit -m "feat(core): x"'` | Invoke | Exit `0`; no `permissionDecision` field — asserted against whichever exact token-match rule the planner records; this fixture is mandatory regardless of that rule's exact shape |

### 2.3 No Bulk Staging (UC-3)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.3.1 | UC-3 Primary Flow, AC-3 | `git add -A` is denied | Any branch | `command: "git add -A"` | Exit `0`; `permissionDecision === "deny"`; reason contains `git add -A` and `git add <path>` |
| 2.3.2 | UC-3, AC-3 | `git add .` is denied identically | Any branch | `command: "git add ."` | Exit `0`; `permissionDecision === "deny"`; reason contains `git add .` |
| 2.3.3 | UC-3-A1, AC-3 (allow) | `git add path/to/file.js` — the guard's everyday, intended path — is not denied | Any branch | `command: "git add path/to/file.js"` | Exit `0`; no `permissionDecision` field |
| 2.3.4 | UC-3-A2 (allow, boundary) | `git add . src/index.js` (extra arguments beyond the bare bulk-add token) is not the literal denied shape | Any branch | `command: "git add . src/index.js"` | Exit `0`; no `permissionDecision` field — documents the literal boundary of the exact-match rule, not a recommended pattern |
| 2.3.5 | UC-3-A3 (allow, escape) | `SDLC_ALLOW_GIT_GUARD=1` allows `git add -A` to proceed | Any branch | Escape set | Exit `0`; no `permissionDecision` field |
| 2.3.6 | UC-3-EC1 (known limitation, documented) | `git add -A .` / `git add --all` (variant spellings) are not literally matched | Any branch | Invoke each | Exit `0`; no `permissionDecision` field for either — recorded as a known limitation of literal pattern matching, not a defect this guard is required to close |

### 2.4 No AI Attribution (UC-4)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.4.1 | UC-4 Primary Flow, AC-4 | `Co-Authored-By: Claude <noreply@anthropic.com>` in the message is denied | Feature branch | `command: 'git commit -m "feat(core): x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"'` | Exit `0`; `permissionDecision === "deny"`; reason contains `Co-Authored-By` |
| 2.4.2 | UC-4-EC1 | The attribution footer on a later line of a multi-line `-m` message is still caught, not only a first-line occurrence | Same as above, footer on line 3 of a 3-line message | Invoke | Exit `0`; `permissionDecision === "deny"` |
| 2.4.3 | UC-4-A2 (case variance, block) | `co-authored-by` (lowercase) and `CO-AUTHORED-BY` (uppercase) both match | Feature branch | Invoke once per casing | Both: exit `0`, `permissionDecision === "deny"` |
| 2.4.4 | UC-4-A1, AC-4 (allow) | The identical message without the attribution line is not denied | Feature branch | `command: 'git commit -m "feat(core): x"'` | Exit `0`; no `permissionDecision` field |
| 2.4.5 | UC-4-A2 (allow, required negative fixture) | A message merely *containing* "Claude" in a legitimate, non-attribution sentence is not denied | Feature branch | `command: 'git commit -m "fix(core): rename ClaudeConfig to AgentConfig"'` | Exit `0`; no `permissionDecision` field — this is the required negative fixture distinguishing "Claude" as bare text from "Claude" as author/co-author |
| 2.4.6 | UC-4-A3 (allow, escape) | `SDLC_ALLOW_GIT_GUARD=1` allows the attributed commit to proceed | Feature branch | Escape set on 2.4.1's command | Exit `0`; no `permissionDecision` field |

### 2.5 Conventional Commit Shape (UC-5)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.5.1 | UC-5 Primary Flow, AC-5 | `docs(readme): x` — both type and scope disallowed — is denied | Feature branch | `command: 'git commit -m "docs(readme): x"'` | Exit `0`; `permissionDecision === "deny"`; reason contains `docs` and the literal list `feat\|fix\|test\|chore` |
| 2.5.2 | UC-5-E1, AC-5 | `refactor(core): x` — disallowed type, allowed scope — is denied | Feature branch | `command: 'git commit -m "refactor(core): x"'` | Exit `0`; `permissionDecision === "deny"`; reason names `refactor` |
| 2.5.3 | UC-5-E2 | `fix stuff` — no parseable `type(scope):` prefix at all — is denied, not silently passed through | Feature branch | `command: 'git commit -m "fix stuff"'` | Exit `0`; `permissionDecision === "deny"`; reason states the message does not match `type(scope): message` |
| 2.5.4 | UC-5-EC1 | `feat(core/db): x` — a compound scope not literally in the allowed list — is denied per the exact-match reading | Feature branch | `command: 'git commit -m "feat(core/db): x"'` | Exit `0`; `permissionDecision === "deny"` — asserted against whichever exact parsing rule the planner records; the default reading (denied) is authoritative absent a documented special case |
| 2.5.5 | UC-5-A1, AC-5 (allow) | `feat(core): x` — the guard's dominant, everyday path — is not denied | Feature branch | `command: 'git commit -m "feat(core): x"'` | Exit `0`; no `permissionDecision` field |
| 2.5.6 | UC-5-A2 (allow, full matrix) | Every one of the 4 allowed types × 6 allowed scopes (24 combinations) is not denied | Feature branch | Invoke once per combination: `feat\|fix\|test\|chore` × `api\|ui\|db\|auth\|core\|infra` | All 24: exit `0`, no `permissionDecision` field |
| 2.5.7 | UC-5-A3 (allow, escape) | `SDLC_ALLOW_GIT_GUARD=1` allows `docs(readme): x` to proceed | Feature branch | Escape set on 2.5.1's command | Exit `0`; no `permissionDecision` field |

### 2.6 Push Requires Explicit Request (UC-6)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.6.1 | UC-6 Primary Flow, AC-6 | A plain `git push` without the escape sentinel is denied | Any branch | `command: "git push"` | Exit `0`; `permissionDecision === "deny"`; reason names `SDLC_ALLOW_GIT_GUARD` and "explicitly asked"; token `rule-3` present |
| 2.6.2 | UC-6-EC2 | `git push origin feat/hook-infrastructure` (explicit remote/branch, not force) — same shape, same result | Any branch | `command: "git push origin feat/hook-infrastructure"` | Exit `0`; `permissionDecision === "deny"` |
| 2.6.3 | UC-6-A1, AC-6 (allow) | `SDLC_ALLOW_GIT_GUARD=1` set immediately before the push allows it to proceed | Any branch | `command: "git push"` with escape set | Exit `0`; no `permissionDecision` field |
| 2.6.4 | UC-6-EC1 (allow, boundary — not this guard's job) | `git push --force` with `SDLC_ALLOW_GIT_GUARD=1` set is refused by `permissions.deny` at the fail-**closed** permission layer, upstream of this guard entirely — this fixture MUST NOT invoke `pre:bash:git-guard`'s own harness | `templates/settings.json`'s `permissions.deny` list (cross-ref `hook-infrastructure_test_cases.md` 13.2.2) | Confirm the deny pattern matches `git push --force`/`git push -f` unconditionally | The refusal happens in Claude Code's own permission engine before any hook process spawns; `pre:bash:git-guard`'s escape sentinel has no effect on it (FR-1.4/FR-2.8) — this is a content check, not a `run-hook.js` invocation |

### 2.7 Backstop — Gate 0 (UC-1-B, UC-3-B)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 2.7.1 | UC-1-B, FR-2.9 (backstop, content check) | Gate 0's stated criteria independently re-check branch and commit-integrity invariants regardless of guard runtime state | `skills/merge-ready/SKILL.md`'s Gate 0 section | Read Gate 0's text | Gate 0 states checks equivalent to "on feature branch," "working tree clean," "all slice commits present" — independent of whether `pre:bash:git-guard` ran at all |
| 2.7.2 | UC-3-B (backstop, content check) | Gate 0's "all slice commits present" / working-tree checks would also catch an over-broad bulk-staged commit | `skills/merge-ready/SKILL.md`'s Gate 0 section | Cross-reference 2.7.1's finding against a bulk-staged-commit scenario | Gate 0's stated scope is broad enough to flag an unaccounted-for file in a commit, independent of `git-guard`'s own bulk-add check |

---

## 3. `pre:write:shrink-guard` (FR-3, UC-7, UC-7-B)

Backstop: `merge-ready` **Gate 1 (Documentation Completeness)** (FR-3.7). Deviation token: `rule-1` (FR-9.6).

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 3.1.1 | UC-7 Primary Flow, AC-7 | A `Write` cutting `docs/PRD.md` from 1600 to 200 lines is denied | Scratch `docs/PRD.md` fixture at 1600 lines | `Write` fixture with 200-line content | Exit `0`; `permissionDecision === "deny"`; reason contains `oldLines`/`1600`, `newLines`/`200`, `threshold`/`640`, and both remedy phrases (`SDLC_ALLOW_SHRINK`, write in full) |
| 3.1.2 | UC-7-A1, AC-7 (allow) | A `Write` that grows the file (1600 → 1650) is not denied | Scratch `docs/PRD.md` at 1600 lines | `Write` with 1650-line content | Exit `0`; no `permissionDecision` field — this and 3.1.3/3.1.4 MUST outnumber the block fixture, since curated documents grow far more often than they legitimately shrink |
| 3.1.3 | UC-7-A2 (allow) | A `Write` to a path outside the curated set never triggers the matcher | Scratch `src/handlers/foo.js` | `Write` with arbitrary short content | Exit `0`; no `permissionDecision` field |
| 3.1.4 | UC-7-A2 (allow, second non-curated path) | A `Write` to `docs/architecture.md` (not matching any of the 5 curated globs) is likewise never inspected | Scratch `docs/architecture.md` | `Write` with 5-line content | Exit `0`; no `permissionDecision` field |
| 3.1.5 | UC-7-A3, AC-7 (allow, escape) | `SDLC_ALLOW_SHRINK=1` allows the 1600→200 `Write` from 3.1.1 to proceed | Same as 3.1.1 | Escape set | Exit `0`; no `permissionDecision` field |
| 3.1.6 | UC-7-EC1 (block, required fixture per FR-3.3) | A curated file already short (`oldLines = 25`) rewritten at the same length (`newLines = 25`) is denied — the 40-line floor dominates below `oldLines = 100` regardless of proportional shrink | Scratch `docs/qa/foo_test_cases.md` at 25 lines | `Write` with 25-line content | Exit `0`; `permissionDecision === "deny"`; reason contains `threshold`/`40` — this is the one guard-behavior detail not derivable from PRD prose alone without a dedicated fixture, per FR-3.3's own text |
| 3.1.7 | UC-7-EC1 (allow, mirror case) | The same short curated file (`oldLines = 25`), rewritten to reach the floor (`newLines = 40`), is not denied | Scratch file at 25 lines | `Write` with exactly 40-line content | Exit `0`; no `permissionDecision` field — demonstrates the floor is a threshold a short file can cross, not a permanent block |
| 3.1.8 | UC-7-EC2 (block) | A brand-new curated file (`oldLines = 0`) written at `newLines = 35` is denied by the same floor | Scratch project with no existing `docs/use-cases/<feature>_use_cases.md` | `Write` creating it with 35-line content | Exit `0`; `permissionDecision === "deny"`; reason states `oldLines`/`0` |
| 3.1.9 | UC-7-EC2 (allow) | The identical new-file case at `newLines ≥ 40` is not denied | Same precondition as 3.1.8 | `Write` with 40+ line content | Exit `0`; no `permissionDecision` field |
| 3.1.10 | UC-7-EC3 (allow, out-of-scope tool) | An `Edit` (not a `Write`) that shrinks a curated file is entirely outside this guard's scope | Scratch `docs/PRD.md` at 1600 lines | `Edit` fixture deleting a large block, dropping the file below 640 lines | Exit `0`; no `permissionDecision` field from `pre:write:shrink-guard` — FR-3.1 names only `Write` |
| 3.1.11 | UC-7-E1 (fail-open, cross-ref) | See Section 1.2.2 for the malfunction-mid-computation negative control | — | — | — |
| 3.1.12 | UC-7-B (backstop, content check) | Gate 1's stated criteria independently verify `docs/PRD.md`/`docs/use-cases/*`/`docs/qa/*` are populated regardless of guard runtime state | `skills/merge-ready/SKILL.md`'s Gate 1 section | Read Gate 1's text | Gate 1 states a population/completeness check for these curated artifacts, independent of `pre:write:shrink-guard`'s own runtime behavior |

---

## 4. `pre:edit:read-guard` (FR-4, UC-8, UC-8-B)

Backstop: `merge-ready` **Gate 4 (Build Verification)** (FR-4.9). Deviation token: `rule-1` (FR-9.6). Registered under two events, one id — `PostToolUse`/`Read` records, `PreToolUse`/`Edit|Write` gates.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 4.1.1 | UC-8 Primary Flow, AC-8 | An `Edit` to an existing file never `Read` this session is denied | Scratch project; existing file `src/handlers/foo.js`; no prior `Read` recorded for this `session_id` | `Edit` fixture under `PreToolUse` | Exit `0`; `permissionDecision === "deny"`; reason names the file path and instructs `Read` before retrying |
| 4.1.2 | UC-8-A1, AC-8 (allow) | An `Edit` after a `Read` in the same session is not denied | Same file; a `Read` fixture invoked first under `PostToolUse` (recorder half), then an `Edit` under `PreToolUse` | Invoke recorder, then gate | Exit `0` on both; the `Edit` invocation shows no `permissionDecision` field |
| 4.1.3 | UC-8-A1 (allow, repeat edits) | A second, later `Edit` to the same already-read file is not re-denied, regardless of how much content changed | Same session, same file, `Read` already recorded (4.1.2) | Invoke `Edit` twice more in sequence | Both: exit `0`, no `permissionDecision` field |
| 4.1.4 | UC-8-A2, AC-8 (allow) | A `Write` creating a brand-new file (does not exist on disk) is never denied, regardless of read history | Target path does not exist | `Write` fixture under `PreToolUse` | Exit `0`; no `permissionDecision` field — checked before the read record at all, per FR-4.4 |
| 4.1.5 | UC-8-A3 (allow, escape) | `SDLC_ALLOW_UNREAD_EDIT=1` allows the unread `Edit` from 4.1.1 to proceed | Same as 4.1.1 | Escape set | Exit `0`; no `permissionDecision` field |
| 4.1.6 | UC-8-EC2 (allow, path-resolution consistency) | A `Read` via a relative path (`./src/handlers/foo.js`) followed by an `Edit` via an equivalent absolute path is treated as the same file | `Read` recorded with relative path; `Edit` issued with the resolved absolute path | Invoke recorder then gate | Exit `0` on the `Edit`; no `permissionDecision` field — a naive string-equality comparison would false-positive-deny this |
| 4.1.7 | UC-8-EC1 (allow, no record from a failed read) | A `Read` that itself fails (targets a nonexistent path) records nothing; a subsequent `Write` to that same nonexistent path is unaffected regardless | `Read` fixture against a nonexistent path (simulated failure) | Invoke recorder (fails), then `Write` to the same still-nonexistent path | Exit `0` on the `Write`; no `permissionDecision` field — covered under FR-4.4's brand-new-file exemption, independent of the failed `Read` |
| 4.1.8 | UC-8-EC3 (allow, no consumption) | The read record is not consumed by a matching `Edit` — two sequential `Edit`s after one `Read` both pass | Same as 4.1.3 | — | Confirmed by 4.1.3 — cited here for explicit traceability to UC-8-EC3 |
| 4.1.9 | (block, compaction case) | A new session id carries no read record even for a file genuinely read in a prior session — the guard denies, and the remedy is exactly one free `Read` under the new session id | Scratch project; file previously read under `session_id: "sess-old"`; `Edit` now issued under a fresh `session_id: "sess-new"` (simulating a post-compaction session) | Invoke `Edit` under `sess-new` with no prior `Read` recorded for `sess-new` | Exit `0`; `permissionDecision === "deny"` — the record is session-keyed, so a prior session's `Read` does not carry over; this is exactly the scenario `src/rules/scratchpad.md`'s "Re-Read Before Edit (MANDATORY)" rule exists to catch, since a context compaction can silently replace an earlier `Read` with a compressed summary |
| 4.1.10 | (allow, compaction remedy) | Following 4.1.9's deny with a fresh `Read` under `sess-new`, then reissuing the identical `Edit`, succeeds | Continuing from 4.1.9 | Invoke `Read` under `sess-new` against the same file, then re-invoke the `Edit` | The `Read` invocation exits `0`; the re-issued `Edit` exits `0` with no `permissionDecision` field — confirms the remedy is a single free `Read`, self-resolving under deviation Rule 1/2 |
| 4.1.11 | UC-8-EC4 (kill switch, both halves) | `SDLC_DISABLED_HOOKS=pre:edit:read-guard` silences **both** event registrations simultaneously — never a partial disable | Any project state | Invoke the `PostToolUse` recorder half and the `PreToolUse` gate half, both with the id disabled | Both: exit `0`, no `permissionDecision`, no `systemMessage`; specifically, an `Edit` to a never-read file is **not** denied while disabled (proving the gate half is off, not merely the recorder) |
| 4.1.12 | UC-8-E1 (fail-open, cross-ref) | See Section 1.2.3 for the malfunction-mid-record-check negative control | — | — | — |
| 4.1.13 | UC-8-B (backstop, content check) | Gate 4's stated criteria (typecheck/test/build) independently catch a defect introduced by an unread-context edit, regardless of guard runtime state | `skills/merge-ready/SKILL.md`'s Gate 4 section | Read Gate 4's text | Gate 4 states a build/test/typecheck verification step that would surface a type error, failing test, or build break resulting from an edit made against stale, unread context |

---

## 5. `pre:edit:config-protection` (FR-5, UC-9, UC-10, UC-9/10-B)

Backstop: `merge-ready` **Gate 2 (Code Review)** (FR-5.8). Deviation token: `rule-3` (FR-9.6).

### 5.1 Config-File Weakening (UC-9)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.1.1 | UC-9 Primary Flow, AC-9 | `tsconfig.json`: `"strict": true → false` is denied | Scratch `tsconfig.json` with `"strict": true` | `Edit` fixture flipping to `false` | Exit `0`; `permissionDecision === "deny"`; reason contains `strict`, `true`, `false`, `SDLC_ALLOW_CONFIG_EDIT` |
| 5.1.2 | FR-5.2(a) (block, other strictness keys) | `noImplicitAny: true → false` is denied identically | Scratch `tsconfig.json` | `Edit` flipping `noImplicitAny` | Exit `0`; `permissionDecision === "deny"`; reason names `noImplicitAny` |
| 5.1.3 | UC-9-EC1 (block) | An ESLint rule severity downgraded `"error"` → `"off"` is denied | Scratch `.eslintrc.json` with a rule at `"error"` | `Edit` downgrading to `"off"` | Exit `0`; `permissionDecision === "deny"` |
| 5.1.4 | UC-9-EC1 (block, removal is equivalent) | A rule key present pre-edit removed entirely from an explicit `rules` block is denied, equivalent to a downgrade | Scratch `.eslintrc.json` with an explicit rule key | `Edit` deleting the rule key | Exit `0`; `permissionDecision === "deny"` |
| 5.1.5 | UC-9-EC2 (block) | An entry removed from `extends` (e.g. dropping `"eslint:recommended"`) is denied | Scratch `.eslintrc.json` with an `extends` array | `Edit` removing one entry | Exit `0`; `permissionDecision === "deny"` |
| 5.1.6 | UC-9-EC2 (block, plugins) | An entry removed from `plugins` is denied identically | Scratch `.eslintrc.json` with a `plugins` array | `Edit` removing one entry | Exit `0`; `permissionDecision === "deny"` |
| 5.1.7 | UC-9-A1, AC-9 (allow) | Adding a new, non-weakening compiler option to `tsconfig.json` is not denied | Scratch `tsconfig.json` | `Edit` adding an unrelated new key | Exit `0`; no `permissionDecision` field |
| 5.1.8 | UC-9-EC3 (allow, strengthening) | Raising a rule's severity (`"warn"` → `"error"`, or `1` → `2`) is not denied — the inverse direction | Scratch `.eslintrc.json` | `Edit` raising severity | Exit `0`; no `permissionDecision` field |
| 5.1.9 | UC-9-A1 (allow, reformat) | A pure whitespace/formatting reflow changing no strictness key, severity, or array entry is not denied | Scratch `tsconfig.json` | `Edit` reformatting only | Exit `0`; no `permissionDecision` field |
| 5.1.10 | UC-9-A2 (allow, no matched files) | A project declaring none of the FR-5.1 config files at all never triggers this check | Scratch project with no `tsconfig*.json`/`.eslintrc*`/etc. | `Edit` to an arbitrary non-config, non-source-suppression file | Exit `0`; no `permissionDecision` field |
| 5.1.11 | UC-9-A3, AC-9 (allow, escape) | `SDLC_ALLOW_CONFIG_EDIT=1` allows the `strict` flip from 5.1.1 to proceed | Same as 5.1.1 | Escape set | Exit `0`; no `permissionDecision` field |

### 5.2 `@ts-nocheck` and Bare `eslint-disable` (UC-10)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.2.1 | UC-10 Primary Flow, AC-9 | Introducing `// @ts-nocheck` at the top of a `.js` source file (not present pre-edit) is denied | Scratch `src/handlers/foo.js` with no `@ts-nocheck` | `Write` adding it | Exit `0`; `permissionDecision === "deny"`; reason contains `@ts-nocheck` and `SDLC_ALLOW_CONFIG_EDIT` |
| 5.2.2 | UC-10-EC1 (block, block-comment form) | `/* eslint-disable */` (block-comment, no rule names) is denied | Scratch `.ts` source file | `Edit` introducing it | Exit `0`; `permissionDecision === "deny"` |
| 5.2.3 | UC-10-EC1 (block, line-comment form) | `// eslint-disable` (line-comment, no rule names) is denied identically | Scratch `.ts` source file | `Edit` introducing it | Exit `0`; `permissionDecision === "deny"` |
| 5.2.4 | UC-10-A1, AC-9 (allow) | A scoped, rule-specific `// eslint-disable-next-line no-unused-vars // justified: generated stub` is not denied — the everyday legitimate pattern | Scratch `.ts` source file | `Edit` introducing a scoped, named, justified disable | Exit `0`; no `permissionDecision` field — the guard's directive scan matches only the bare, unscoped form |
| 5.2.5 | UC-10-A2 (allow, pre-existing) | `@ts-nocheck` already present in the file's pre-edit content, with an unrelated part of the file edited, is not denied | Scratch file with pre-existing `@ts-nocheck` | `Edit` touching an unrelated line, `@ts-nocheck` untouched | Exit `0`; no `permissionDecision` field — the guard only fires on directives newly introduced by this call |
| 5.2.6 | UC-10-A3 (allow, escape) | `SDLC_ALLOW_CONFIG_EDIT=1` allows the new `@ts-nocheck` from 5.2.1 to proceed | Same as 5.2.1 | Escape set | Exit `0`; no `permissionDecision` field |
| 5.2.7 | UC-10-A4 (allow, total silence) | A project with no matched config files and no newly-introduced directive produces total guard silence | Scratch project, plain `.js` edit with no directive of any kind | `Edit` unrelated to any check | Exit `0`; no `permissionDecision`; no `systemMessage` |

### 5.3 Scope Exclusion — This Repository's Own Docs and Fixtures (FR-5.3, AC-10) — critical

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.3.1 | AC-10 | An `Edit` under `tests/fixtures/**` introducing the literal string `@ts-nocheck` is never denied | Scratch `tests/fixtures/hooks/guards/foo.ts` | `Edit`/`Write` introducing `@ts-nocheck` as literal fixture content | Exit `0`; no `permissionDecision` field, regardless of content — FR-5.3's exclusion is precisely why the pipeline can write its own guard fixtures without self-blocking |
| 5.3.2 | AC-10 | An `Edit` under `docs/**` introducing the literal string `@ts-nocheck` (as documentation text, e.g. this PRD section itself) is never denied | Scratch `docs/qa/blocking-guards_test_cases.md`-shaped file | `Edit` introducing the literal string as prose | Exit `0`; no `permissionDecision` field |
| 5.3.3 | AC-10 | A `*.md` file anywhere (not only under `docs/`) introducing the literal string `eslint-disable` unscoped is never denied | Scratch `CHANGELOG.md`-shaped or any other `*.md` file | `Edit` introducing the literal bare string | Exit `0`; no `permissionDecision` field |
| 5.3.4 | FR-5.3 (contrast) | The identical literal string introduced in an actual `.ts` source file **outside** `tests/fixtures/**`/`docs/**`/`*.md` is still denied | Scratch `src/handlers/foo.ts` | `Edit` introducing `@ts-nocheck` | Exit `0`; `permissionDecision === "deny"` — confirms 5.3.1–5.3.3 are a scoped exclusion, not a global regression of 5.2's checks |

### 5.4 Fail-Open and Backstop

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 5.4.1 | UC-9-E1/UC-10-E1 (fail-open, cross-ref) | See Section 1.2.4 for the malfunction-mid-diff negative control | — | — | — |
| 5.4.2 | UC-9/10-B (backstop, content check) | Gate 2's stated criteria ("proper types, no dead code, error handling present," delegated to `code-reviewer`) independently re-check source-level quality regardless of guard runtime state | `skills/merge-ready/SKILL.md`'s Gate 2 section | Read Gate 2's text | Gate 2's stated scope covers reviewing changed files for exactly this class of defect, independent of `pre:edit:config-protection`'s own runtime behavior |

---

## 6. `pre:agent:isolation-guard` (FR-6, UC-11, UC-11-B)

Backstop: the changelog idempotency guard (Section 5 FR-1.6), then `merge-ready` **Gate 0** (FR-6.7). Deviation token: `rule-3` (FR-6.2 branch only — FR-6.3's branch never denies, so no token applies to it).

**Branch dependency, read before writing any of the below:** FR-6.1 requires a mandatory spike, run once as the first unit of work, to determine whether `PreToolUse` stdin reliably distinguishes a subagent-originated call from an orchestrator-originated one. Its finding determines which of Sections 6.1/6.2 below is the one the shipped handler actually implements — the two branches are mutually exclusive by construction (FR-6.2 XOR FR-6.3, UC-11-EC2). Both are documented here in full, mirroring UC-11's own Primary Flow A/B structure, because the spike's outcome is not known at QA-authoring time; **only one of Section 6.1 or 6.2's suites will apply to the shipped implementation** — the implementation record's recorded spike finding determines which, per FR-6.4.

### 6.1 Branch A — If the Spike Finds a Reliable Indicator (FR-6.2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.1.1 | UC-11 Primary Flow A, AC-11 | A subagent `Write` to `.claude/scratchpad.md` is denied | Stdin fixture carrying the confirmed subagent indicator (per the spike's recorded field/rule); `Write` targeting `.claude/scratchpad.md` | Invoke | Exit `0`; `permissionDecision === "deny"`; reason names the target file and "orchestrator" |
| 6.1.2 | UC-11 Primary Flow A (block, second target) | A subagent `Write` to `CHANGELOG.md` is denied identically | Same subagent indicator; `Write` targeting `CHANGELOG.md` | Invoke | Exit `0`; `permissionDecision === "deny"` |
| 6.1.3 | UC-11-A1, AC-11 (allow) | The orchestrator's own `Write` to `.claude/scratchpad.md` (no subagent indicator present) is not denied — the guard's everyday, expected path, per `src/rules/scratchpad.md`'s "MUST Write" rule | Stdin fixture with no subagent indicator; `Write` targeting `.claude/scratchpad.md` | Invoke | Exit `0`; no `permissionDecision` field |
| 6.1.4 | UC-11-A1 (allow, second target) | The orchestrator's own `Write` to `CHANGELOG.md` is not denied identically | Same as above, target `CHANGELOG.md` | Invoke | Exit `0`; no `permissionDecision` field |
| 6.1.5 | UC-11-A2 (allow, escape) | `SDLC_ALLOW_SUBAGENT_WRITE=1` allows the subagent write from 6.1.1 to proceed | Same as 6.1.1 | Escape set | Exit `0`; no `permissionDecision` field |
| 6.1.6 | UC-11-A3 (allow, out-of-scope file) | A subagent's `Edit`/`Write` to any file other than the two protected paths (e.g. its own assigned slice's source file) is never inspected — a subagent legitimately edits source files as its entire purpose | Same subagent indicator; target `src/handlers/foo.js` | Invoke | Exit `0`; no `permissionDecision` field |
| 6.1.7 | UC-11-EC3 (kill switch) | `SDLC_DISABLED_HOOKS=pre:agent:isolation-guard` disables the deny logic entirely | Same as 6.1.1 | Invoke with the id disabled | Exit `0`; no `permissionDecision`; no `systemMessage` |

### 6.2 Branch B — If the Spike Finds No Reliable Indicator (FR-6.3): Fail Visibly, Never Silently

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.2.1 | UC-11 Primary Flow B, AC-11 | A simulated subagent-origin `Write` to `.claude/scratchpad.md` produces an unconditional visible warning, never a deny | Stdin fixture simulating subagent origin (using whatever field the spike investigated, even though it was found unreliable) | Invoke | Exit `0`; **no** `permissionDecision` field; `systemMessage` states plainly that subagent-origin cannot be determined and this guard cannot enforce the isolation rule mechanically |
| 6.2.2 | UC-11 Primary Flow B, AC-11 (the "not silently inert" proof — mandatory per task) | A simulated orchestrator-origin `Write` to the same file produces the **identical** warning — proving the guard is not silently never-firing for one origin while appearing to work for the other | Stdin fixture simulating orchestrator origin, same target file | Invoke | Exit `0`; no `permissionDecision` field; `systemMessage` text is byte-identical in trigger condition to 6.2.1's — fires unconditionally on every matching write regardless of origin, which is the AC-11 dual-fixture requirement |
| 6.2.3 | UC-11 Primary Flow B (allow, `CHANGELOG.md`) | The same unconditional warning (never a deny) fires for `CHANGELOG.md` writes, both origins | Both stdin variants, target `CHANGELOG.md` | Invoke both | Both: exit `0`, no `permissionDecision`, identical warning `systemMessage` |
| 6.2.4 | UC-11-EC3 (kill switch, whole handler) | `SDLC_DISABLED_HOOKS=pre:agent:isolation-guard` silences the visible warning itself — in this branch, there is no blocking capability to separately disable, so disabling the id disables the entire handler | Same as 6.2.1 | Invoke with the id disabled | Exit `0`; no `systemMessage` at all |

### 6.3 Fail-Open and Backstop

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 6.3.1 | UC-11-E1 (fail-open, cross-ref) | See Section 1.2.5 for the malfunction-mid-determination negative control (applies identically to either branch) | — | — | — |
| 6.3.2 | UC-11-B (backstop, content check — idempotency guard) | The changelog idempotency guard collapses a colliding subagent write to `CHANGELOG.md` into an in-place update rather than a duplicate, independent of this guard's runtime state | `skills/merge-ready/SKILL.md`'s changelog finalization section (idempotency guard, line ~126) | Read the idempotency guard's stated behavior | The stated rule collapses same-name entries under today's date into an update, independent of `pre:agent:isolation-guard`'s own behavior |
| 6.3.3 | UC-11-B (backstop, content check — Gate 0) | Gate 0's "working tree clean" check independently surfaces an unaccounted-for scratchpad/changelog mutation attributable to a subagent | `skills/merge-ready/SKILL.md`'s Gate 0 section | Cross-reference 2.7.1's finding | Gate 0's stated scope would flag such a mutation as an unexpected working-tree change before merge, as the second, independent backstop |

---

## 7. `stop:changelog-guard` (FR-7, UC-12, UC-12-B)

Backstop: `merge-ready`'s **changelog finalization step** (FR-7.6). Deviation token: `rule-1` (FR-9.6). Single event: `Stop`. Blocking is carried as top-level `decision: "block"` / `reason`, never `hookSpecificOutput`, never an exit code (FR-7.4, FR-9.2, FR-9.8).

### 7.1 Block — Shape Defects (UC-12 Primary Flow, UC-12-E1, UC-12-E2)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.1.1 | UC-12 Primary Flow, AC-12 | An entry missing a `**Details:**` line entirely is blocked | Scratch `CHANGELOG.md`; new entry with today's day heading, correct entry heading, `**Summary:**` present, no `**Details:**` line; `git status --porcelain` shows the file changed | `Stop` fixture | Exit `0`; top-level `decision === "block"`; `reason` names `**Details:**` |
| 7.1.2 | FR-7.2(c) (block, missing Summary) | An entry with `**Details:**` present but no `**Summary:**` line is blocked | Same setup, `**Summary:**` line omitted | `Stop` fixture | Exit `0`; `decision === "block"`; `reason` names `**Summary:**` |
| 7.1.3 | FR-7.2(a)/(b) (block, malformed entry heading) | The entry heading does not match `### <name> — HH:MM UTC` (e.g. missing the `UTC` suffix, or missing the em dash) | Scratch `CHANGELOG.md` with a malformed heading | `Stop` fixture | Exit `0`; `decision === "block"`; `reason` identifies the malformed heading shape |
| 7.1.4 | UC-12-E1, AC-12 (block, duplicate) | Two entries under today's heading with the same name (case-insensitive, trimmed) | Scratch `CHANGELOG.md` with `### Add CSV export — ...` appearing twice under today | `Stop` fixture | Exit `0`; `decision === "block"`; `reason` names the duplicated entry name and instructs an in-place update instead |
| 7.1.5 | UC-12-E2, AC-12 (block, Details too long) | `**Details:**` exceeds 500 characters | Scratch `CHANGELOG.md` with a 550-character Details line | `Stop` fixture | Exit `0`; `decision === "block"`; `reason` states the character count and the 500-character cap |

### 7.2 Allow — Well-Formed Entries, No Change, Elapsed Time Immaterial

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.2.1 | UC-12-A1, AC-12 (allow) | An entry meeting all FR-7.2 shape requirements does not block `Stop` | Scratch `CHANGELOG.md` with a fully well-formed new entry | `Stop` fixture | Exit `0`; no `decision` field (or `decision` absent/not `"block"`); the block counter resets to `0` |
| 7.2.2 | UC-12-A2 (allow) | `CHANGELOG.md` was not modified this response — the guard no-ops entirely without inspecting content | `git status --porcelain -- CHANGELOG.md` shows no change | `Stop` fixture | Exit `0`; no `decision` field; the guard performs no content inspection at all |
| 7.2.3 | UC-12-A3, AC-12 (allow — the explicit freshness prohibition, mandatory per task) | An entry whose stated `HH:MM UTC` is 40 minutes older than the guard's own simulated invocation time still passes if shape is otherwise correct | Scratch `CHANGELOG.md` with a well-formed entry stamped 40 minutes before the `Stop` fixture's simulated "now" | `Stop` fixture with a synthetic 40-minute elapsed-time gap | Exit `0`; same pass outcome as 7.2.1 — the elapsed time has zero effect on the result; the guard MUST NOT compare the entry's stated time against its own clock (FR-7.3) |
| 7.2.4 | FR-7.3 (allow, elapsed-time equivalence, explicit control) | A zero-elapsed-time fixture and a 40-minute-elapsed fixture with otherwise identical shape content produce the identical PASS result | Two fixtures differing only in simulated elapsed time | Invoke both | Both: identical outcome (no block) — confirms elapsed time has no bearing whatsoever on the guard's decision |
| 7.2.5 | UC-12-A4 (allow, escape) | `SDLC_ALLOW_CHANGELOG_SHAPE=1` allows the missing-`**Details:**` entry from 7.1.1 to proceed without blocking `Stop` | Same as 7.1.1 | Escape set | Exit `0`; no `decision: "block"` field — a non-blocking `systemMessage` MAY still note the defect |

### 7.3 Bounded Blocking (UC-12-E3) — 2-Consecutive Cap

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.3.1 | UC-12-E3, AC-12 | Three consecutive `Stop` events in the same session, each with a still-defective entry, block on the first two and fall back to a non-blocking warning on the third | Same `session_id` across three sequential `Stop` invocations, each with a shape-defective entry and no intervening pass | Invoke `Stop` three times in sequence, inspecting the session-keyed block-counter state file under `.claude/tmp/` after each | 1st: `decision === "block"`, counter → `1`. 2nd: `decision === "block"`, counter → `2`. 3rd: **no** `decision: "block"` field; a non-blocking `systemMessage` warning is emitted instead; `Stop` proceeds |
| 7.3.2 | UC-12-EC2 (counter semantics) | The counter resets to `0` on any passing check — a block-then-pass-then-fail sequence starts a fresh count of `1`, not `2` | Same session; `Stop` sequence: defective (block), well-formed (pass), defective (block) | Invoke three times in sequence, inspecting the counter after each | 1st: block, counter → `1`. 2nd: pass, counter → `0`. 3rd: block, counter → `1` — confirms "consecutive" is literal, not cumulative |

### 7.4 Fail-Open, Edge Cases, Backstop

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 7.4.1 | UC-12-E4 (fail-open, cross-ref) | See Section 1.2.6 for the malfunction-mid-shape-assertion negative control | — | — | — |
| 7.4.2 | UC-12-EC1 | `CHANGELOG.md` newly created this response (not a modification of an existing file) still has its content inspected against the same FR-7.2 assertions | `git status --porcelain` reports `CHANGELOG.md` as an addition | `Stop` fixture with a first-ever entry, deliberately shape-defective | Exit `0`; `decision === "block"` — the "addition" case is inspected identically to a modification |
| 7.4.3 | UC-12-EC3 (design check, content check) | The guard determines "changed this response" via `git status --porcelain`, never via `post:edit:accumulate`'s accumulator file, avoiding an ordering race with `stop:typecheck-format` | `hooks/handlers/stop-changelog-guard.js` source | Grep the handler source for any reference to the accumulator module (`hooks/lib/accumulator.js`) or a `.paths` file read | No such reference — the handler relies solely on a `git status --porcelain -- CHANGELOG.md` subprocess call |
| 7.4.4 | UC-12-B (backstop, content check) | The merge-ready changelog finalization step re-invokes `doc-updater` against the same format rules and idempotency check, independent of guard runtime state | `skills/merge-ready/SKILL.md` lines ~114–135 | Read the finalization step's text | The step states it delegates the write to `doc-updater` following `changelog.md`'s rules and applies the idempotency guard before writing, regardless of whether `stop:changelog-guard` degraded or bound-exhausted during the session |

---

## 8. Deferred — `pre:edit:gateguard` (UC-13) — Out of Scope, Verified Absent

`pre:edit:gateguard` is not implemented by this feature (Design Decision 9, PRD 8.10 Risk 4). No positive test cases exist for it in this document. The following confirms the deferral holds mechanically, so a future accidental reintroduction does not slip past CI silently.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 8.1.1 | UC-13 (deferred — non-implementation check) | `pre:edit:gateguard` is not registered in `hooks/hooks.json` or `run-hook.js`'s `HOOKS` map | Implementation complete | Grep `hooks/hooks.json` and `hooks/lib/run-hook.js` for the literal string `gateguard` | Zero matches — confirms no partial or accidental registration exists |
| 8.1.2 | UC-13, AC-19, NFR-4 (deferred — asset budget check) | Total shipped hook handler count is exactly 9, not 10 | Implementation complete | `ls hooks/handlers/*.js \| wc -l` | Exactly `9` — Section 7's 3 plus this feature's 6; a 10th file would indicate GateGuard was smuggled in |
| 8.1.3 | UC-13 (deferred — env var check) | `SDLC_GATEGUARD` has no effect anywhere in this harness | Implementation complete | Invoke any of the 6 shipped guards with `SDLC_GATEGUARD=on` set | Behavior identical to the same invocation without the variable set — confirms the literal opt-in token from the deferred guard's design has not been wired to anything |

---

## 9. Kill Switches — Cross-Guard Sweep (UC-15, FR-9.3, AC-17)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 9.1.1 | UC-15 Primary Flow, AC-17 | `SDLC_DISABLED_HOOKS` listing all 6 guard ids at once suppresses every one of them across every block scenario in Sections 2–7 | `SDLC_DISABLED_HOOKS=pre:bash:git-guard,pre:write:shrink-guard,pre:edit:read-guard,pre:edit:config-protection,pre:agent:isolation-guard,stop:changelog-guard` | Reissue every block-side fixture from Sections 2.1–2.6, 3.1.1, 3.1.6, 3.1.8, 4.1.1, 5.1.1–5.1.6, 5.2.1–5.2.3, 6.1.1–6.1.2 (or 6.2.1's branch), 7.1.1–7.1.5, with the kill switch set | Zero denials and zero guard-originated `systemMessage`s across the entire sequence — every call proceeds exactly as if none of the 6 guards existed |
| 9.1.2 | UC-15-A1 | `SDLC_HOOKS_ENABLED=0` suppresses all 6 guards AND Section 7's original 3 hooks simultaneously | Any block-scenario fixture from any of the 9 hooks | Invoke with `SDLC_HOOKS_ENABLED=0` | All 9: exit `0`, no decision field, no `additionalContext`, no accumulator write, no format/typecheck run — behaviorally identical to the plugin never being installed |
| 9.1.3 | UC-15-A2 | Listing only one guard id (`SDLC_DISABLED_HOOKS=pre:edit:config-protection`) leaves the other 5 fully active | Fixture from 5.1.1 (config-protection block) and 2.1.1 (git-guard block) | Invoke both with only `pre:edit:config-protection` disabled | 5.1.1: exit `0`, no `permissionDecision` (suppressed). 2.1.1: exit `0`, `permissionDecision === "deny"` (still active) |
| 9.1.4 | UC-15-E1 | A typo'd id (`pre:bash:gitguard`, missing the hyphen) does not suppress the real `pre:bash:git-guard` | `SDLC_DISABLED_HOOKS=pre:bash:gitguard` | Invoke 2.1.1's `main`-branch commit fixture | Exit `0`; `permissionDecision === "deny"` — the guard remains fully active; the malformed entry is inert, not an error |
| 9.1.5 | UC-15-EC1 | Listing `pre:edit:read-guard` disables both the `PostToolUse` recorder half and the `PreToolUse` gate half simultaneously | `SDLC_DISABLED_HOOKS=pre:edit:read-guard` | Invoke the recorder half (no-op expected) then the gate half against an unread file (allow expected, not deny) | Both: exit `0`. Critically, the gate half does **not** deny the unread `Edit` while disabled — a partial disable (gate active, recorder inert) would instead deny every `Edit`, a false-positive hazard this test rules out |
| 9.1.6 | UC-15-EC2 | `SDLC_HOOKS_ENABLED=0` and a per-guard escape sentinel set simultaneously is redundant, not conflicting | `SDLC_HOOKS_ENABLED=0`, `SDLC_ALLOW_GIT_GUARD=1` both set | Invoke 2.1.1's fixture | Exit `0`; no `permissionDecision`; no error from the redundant combination |
| 9.1.7 | FR-9.3 (content check) | All 6 guard ids are present as valid `HOOKS` map entries, so `SDLC_DISABLED_HOOKS` can target each by name | `hooks/lib/run-hook.js` | Read the `HOOKS` map | Contains exactly the 6 ids: `pre:bash:git-guard`, `pre:write:shrink-guard`, `pre:edit:read-guard`, `pre:edit:config-protection`, `pre:agent:isolation-guard`, `stop:changelog-guard`, alongside Section 7's original 3 |

---

## 10. Deviation-Rule Token and Remedy Self-Sufficiency (FR-9.5, FR-9.6, AC-13)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 10.1.1 | FR-9.6, AC-13 | Every captured deny reason from Sections 2.1–2.6 (`git-guard`'s five checks) embeds the literal token `[deviation: rule-1 — ...]`, except the push check | Deny reasons captured in 2.1.1–2.5.7 | Regex-match each captured `permissionDecisionReason` against `/\[deviation: rule-1 — .+?, free\]/` for the branch/`--no-verify`/bulk-add/attribution/conventional-commit checks | Match found in every one |
| 10.1.2 | FR-9.6, AC-13 | `git-guard`'s push-check deny reason (2.6.1) embeds `rule-3`, distinct from the other five checks | Deny reason from 2.6.1 | Regex-match against `/\[deviation: rule-3 — .+?, costs 1 retry\]/` | Match found |
| 10.1.3 | FR-9.6, AC-13 | `shrink-guard`'s deny reason (3.1.1) embeds `rule-1` | Deny reason from 3.1.1 | Regex-match against `rule-1` token pattern | Match found |
| 10.1.4 | FR-9.6, AC-13 | `read-guard`'s deny reason (4.1.1) embeds `rule-1` | Deny reason from 4.1.1 | Regex-match | Match found |
| 10.1.5 | FR-9.6, AC-13 | `config-protection`'s deny reasons (5.1.1, 5.2.1) embed `rule-3` | Deny reasons from 5.1.1, 5.2.1 | Regex-match against `rule-3` token pattern | Match found in both |
| 10.1.6 | FR-9.6, AC-13 | `isolation-guard`'s deny reason (6.1.1, FR-6.2 branch only) embeds `rule-3` | Deny reason from 6.1.1 | Regex-match | Match found — not applicable if the FR-6.3 branch ships, since that branch never denies |
| 10.1.7 | FR-9.6, AC-13 | `changelog-guard`'s block reason (7.1.1) embeds `rule-1` | Block reason from 7.1.1 | Regex-match | Match found |
| 10.1.8 | FR-9.5(b), AC-13 (self-sufficiency sweep) | No captured deny/block reason across Sections 2–7 contains a bare, unresolved reference to `error-recovery.md` (or any other external document) without inline restatement of what it means | All deny/block reasons captured across Sections 2.1–7.4 | Grep each captured reason string for `error-recovery.md` | Zero matches — every reason is fully self-sufficient per FR-9.5(b), readable with zero reliance on any document outside the string itself (relevant specifically to a plugin-only adopter who never ran `install.sh` and has no `~/.claude/rules/error-recovery.md` in their memory layer at all) |
| 10.1.9 | FR-9.5(a) (remedy concreteness sweep) | Every captured deny/block reason states a specific next action, never merely restates which rule was violated | Same set as 10.1.8 | Inspect each reason for a concrete, actionable instruction (a command to run, an env var to set, a file to read) beyond naming the violated rule | Every reason contains at least one concrete remedy phrase |

---

## 11. No Self-Granted Exceptions (FR-9.7) — Content Check

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 11.1.1 | FR-9.7 | No guard handler writes to its own escape-sentinel environment variable | All 6 guard handler source files | Grep each for an assignment (not a read) to `process.env.SDLC_ALLOW_*` — e.g. `process.env.SDLC_ALLOW_GIT_GUARD =` | Zero matches — every guard only reads these variables, never sets them |
| 11.1.2 | FR-9.7 | No guard handler writes to `SDLC_DISABLED_HOOKS` | All 6 guard handler source files, plus `hooks/lib/run-hook.js` | Grep for an assignment to `process.env.SDLC_DISABLED_HOOKS` | Zero matches |
| 11.1.3 | FR-9.7 (runtime confirmation) | A guard cannot grant itself a permanent exception mid-invocation — its own process's env mutations (if any) do not persist to the next invocation | Two sequential `runHook()` calls for the same guard id, no env override on the second call | Invoke `pre:bash:git-guard` once on a denying fixture, then invoke it again immediately afterward with no escape sentinel set | The second invocation still denies — confirms no env mutation from the first call leaked into the second (each `runHook()` spawns a fresh child process, so this is structurally guaranteed, but the assertion documents the expectation explicitly) |

---

## 12. CI Regression Assertion Narrowing (UC-16, FR-10.1, FR-10.3, AC-16) — Content Checks

Per FR-10, the runtime deny/fail-open assertions that used to be verified by source grep (UC-16-A1, in the use-case document's original framing) are now verified by Section 1's runtime fixtures instead — **not** duplicated here as a second grep-based positive control, per FR-10.2's explicit instruction that a static grep cannot detect a swallowed deny. What remains genuinely static (and correctly so, since these check *absence*, not *working capability*) is the narrowed sweep below.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 12.1.1 | UC-16 Primary Flow, FR-10.1(a), AC-16 | The no-`exit(2)` check remains repository-wide, scanning all files under `hooks/`, including `run-hook.js` and all 6 new guard handlers | `tests/hooks/test-wrapper.js`'s sweep | Run the sweep against the real, shipped `hooks/` tree | Exit `0` — zero `exit(2)`/`exitCode = 2` occurrences anywhere, across all 11 hook-related files (4 Section 7 + `run-hook.js` counted once + 6 Section 8, or as the implementation structures the walk) |
| 12.1.2 | UC-16 Primary Flow, FR-10.1(b), AC-16 | The no-`permissionDecision`/no-`decision: "block"` check is narrowed to scan only Section 7's 3 original handler files | `tests/hooks/test-wrapper.js`'s sweep, post-narrowing | Run the sweep; separately, inspect the sweep's own file list directly in source | The sweep exits `0` scanning exactly `session-start-spine.js`, `post-edit-accumulate.js`, `stop-typecheck-format.js`; the file list explicitly excludes `run-hook.js` and all 6 guard handlers — verified by reading the list directly, not merely observing the sweep currently passes (AC-16's own stronger requirement) |
| 12.1.3 | UC-16-E2 (inverse regression, still caught) | A future accidental `permissionDecision` field introduced into `post-edit-accumulate.js` (e.g. a copy-paste mistake) still fails the narrowed sweep | Seeded fixture: a copy of `post-edit-accumulate.js` with an injected `permissionDecision` string | Run the sweep against the seeded fixture in place of the real file | Sweep exits non-zero, naming the offending file — confirms narrowing the file list did not weaken the assertion for the files still in scope |
| 12.1.4 | UC-16-E3 (misconfiguration self-flags) | If the narrowed sweep's file list were accidentally misconfigured to include one of the 6 new guard handlers, the sweep immediately fails — since every guard legitimately contains a `permissionDecision`/`decision` construction path | Seeded test: temporarily add `pre-bash-git-guard.js` to the sweep's scanned-file list | Run the sweep with the misconfigured list | Sweep exits non-zero — self-flags the misconfiguration rather than silently passing with the wrong scope |
| 12.1.5 | UC-16-EC1, FR-10.3 (CI wiring, content check) | Both the narrowed sweep and Section 1's runtime deny/fail-open fixtures run in the same `validate-assets` CI job | `.github/workflows/ci.yml` | Read the `validate-assets` job's steps | A step runs `tests/hooks/test-wrapper.js` (narrowed sweep) and a step runs `tests/hooks/test-guards.js` (Section 1's runtime fixtures, FR-10.2), both in the same job, alongside Section 7's existing invocations — a regression in either direction fails the same job |
| 12.1.6 | FR-10.3 (failure propagation) | The `validate-assets` job fails if either the sweep or the runtime guard fixtures fail | Same job as 12.1.5 | Inspect the job's step configuration for `continue-on-error` or swallowed exit codes | No step suppresses a non-zero exit; a failure in either check propagates to fail the job |

---

## 13. Implementation Ordering Constraint (FR-10.4, AC-20) — Content Check

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 13.1.1 | FR-10.4, AC-20 | The wrapper-deny-channel-and-sweep-narrowing commit(s) (FR-1.6–FR-1.10, FR-10.1) precede every guard-handler commit (FR-2 through FR-7) in `git log` | This feature's full commit history on its feature branch | Run `git log --oneline --reverse` for this feature's commits; identify the commit(s) touching `hooks/lib/run-hook.js`'s deny channel and `tests/hooks/test-wrapper.js`'s narrowing, versus the commits introducing each of the 6 `hooks/handlers/pre-*`/`stop-changelog-guard.js` files | The wrapper-channel commit(s) appear strictly before every guard-handler commit in the ordered log |
| 13.1.2 | FR-10.4, AC-20 (the CI-green proof) | Re-running CI at the wrapper-channel commit alone (before any guard handler exists) passes green | The specific commit identified in 13.1.1 as the wrapper-channel commit | Check out that commit in isolation; run the full CI suite (`validate-assets` at minimum) | CI passes at that commit — proves the ordering constraint is not merely a commit-order convention but an actually-buildable intermediate state |
| 13.1.3 | FR-10.4 (the failure this constraint prevents, negative documentation) | Committing a guard handler before the wrapper-channel-and-sweep-narrowing work would fail CI at that point in history | Hypothetical / documented scenario, not executed against the real repository | Reason about (or, if a throwaway branch is used for this specific regression proof, actually attempt) committing a guard handler against the still-unnarrowed Section 7 sweep | The still-unnarrowed sweep (12.1.2's pre-narrowing state) would flag the new `permissionDecision` string the moment `run-hook.js` gains it, or the guard handler would have no wrapper channel yet built to carry its deny — either way CI fails, confirming why FR-10.4 is a hard ordering requirement and not a suggestion |

---

## 14. Autonomy Regression Test (UC-17, FR-11, AC-18) — the Section's Primary Acceptance Criterion

This is not a unit-testable fixture in the sense of Sections 1–13 — it is a full, live, scripted run of `/develop-feature` on a seeded feature, observed rather than asserted line-by-line. It is included here as the section's highest-stakes test case because every guard documented above is worthless in aggregate if, together, they stall an unattended run. **How to run it and how to judge it:**

**Setup:** All 6 guards enabled at the `standard` hook profile (FR-1.5). **No** `SDLC_DISABLED_HOOKS` entries and **no** per-guard escape sentinel (`SDLC_ALLOW_GIT_GUARD`, `SDLC_ALLOW_SHRINK`, `SDLC_ALLOW_UNREAD_EDIT`, `SDLC_ALLOW_CONFIG_EDIT`, `SDLC_ALLOW_SUBAGENT_WRITE`, `SDLC_ALLOW_CHANGELOG_SHAPE`) set anywhere in the environment at the start of the run. The seeded feature MUST be deliberately small and unremarkable — no genuine architectural ambiguity — so a Rule-4 escalation (assumed not to arise) is never conflated with a guard defect (UC-17-EC1).

**Execution:** Invoke `/develop-feature` on the seeded feature and let it run to completion unattended, capturing the full transcript: every tool call, every guard invocation and its outcome (deny/allow/fail-open), every retry, and the run's terminal state.

**Judgment — decompose the recorded transcript into:**
1. Whether `MERGE READY` was reached at all.
2. Whether any **hard failure** occurred (UC-17-E1 or UC-17-E2 below) — if so, the test **fails**, regardless of whether `MERGE READY` was still nominally reached.
3. Whether any **soft failure** occurred (UC-17-E3 below) and how many times — recorded separately; does not by itself fail the test, but disqualifies a clean pass.

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 14.1.1 | UC-17 Primary Flow, AC-18 | A full `/develop-feature` run on a seeded feature reaches `MERGE READY` with zero human interventions | Setup as described above | Run to completion; inspect the transcript | `MERGE READY` reached; zero tool-call or `Stop` events required human input at any point |
| 14.1.2 | UC-17-A1 | The run encountering and self-resolving multiple denials from different guards along the way is a pass, not a failure — the bar is zero human interventions, not zero denials | Same run | Inspect the transcript for denial-then-self-resolution sequences (e.g. an early `git commit` on `main` before switching branches, an `Edit` denied for lacking a prior `Read` after a simulated compaction) | Each denial is followed, within the model's own retry budget, by a self-correction and successful retry — no human input requested at any point |
| 14.1.3 | UC-17-E1 (hard failure — stall) | A guard denies a call the model cannot self-resolve within its 3-retries-per-slice budget, and the run halts waiting on input that never arrives | Same run, failure-mode detection | If the transcript shows no further tool calls issued after a denial and no `MERGE READY` reached | Test **fails**; the specific guard and denied call that produced the stall are recorded in the implementation record |
| 14.1.4 | UC-17-E2 (hard failure — observed human intervention) | Any point where a human answers a permission prompt, manually exports an env var, manually edits a file to work around a denial, or manually runs a command the model itself should have issued | Same run | Inspect the transcript and any scripted-harness injection beyond the feature's initial seed description | If found: test **fails** — the harness injecting anything beyond the initial seed counts as this failure mode even without a literal interactive human present |
| 14.1.5 | UC-17-E3, AC-12 (soft failure — bound exhaustion) | `stop:changelog-guard`'s 3rd-consecutive-failure non-blocking fallback (Section 7.3.1) is reached more than once across the whole run | Same run | Count occurrences of the 3-consecutive-block pattern across the transcript | If reached more than once: recorded as a soft failure — does not itself halt the run or fail AC-18's letter, but disqualifies the run from counting as a **clean** pass, and the guard's message wording is flagged for review before the feature is considered validated |
| 14.1.6 | UC-17-EC1 (test-design validity) | The seeded feature is confirmed deliberately unremarkable, not deliberately ambiguous | The seeded feature's own description, reviewed before the run starts | Confirm the seed contains no genuine architectural ambiguity requiring a Rule-4 escalation | If the seed is found to be ambiguous by design, the test run is invalid regardless of its outcome — it cannot distinguish "the guards work" from "the feature was underspecified" |
| 14.1.7 | UC-17-EC2 (assertion framing) | The scripted test's pass/fail assertion is "zero `Stop`/tool-call events required human input," never "zero denials occurred" | Same run, meta-check on the test's own design | Confirm the test harness's own pass/fail logic matches this framing | A single, immediately self-resolved denial does not, and must not, register as a failure under the test's own scoring |
| 14.1.8 | FR-11.2 (repeatability) | The regression run is a repeatable, scripted test, not a one-off manual observation, and its result is recorded in the implementation record | Test harness/scripting for this run | Confirm the run can be re-invoked mechanically (same seeded feature, same guard configuration) and produces a recorded PASS/FAIL artifact | The implementation record contains a decomposed PASS/FAIL result per the three-part judgment above, not merely an informal note that "it worked" |

---

## 15. Cross-Cutting NFRs and Asset Budget (NFR-1–NFR-4, AC-19)

| # | Use Case | Test Case | Preconditions | Steps | Expected Result |
|---|----------|-----------|---------------|-------|-----------------|
| 15.1.1 | NFR-1 | All 6 guard handler modules have zero npm runtime dependencies | `hooks/` tree | Check for a `package.json` under `hooks/`; if present, inspect `dependencies` | No `package.json` requiring `npm install`, or one declaring zero runtime dependencies — consistent with `hook-infrastructure_test_cases.md` 16.1.3 |
| 15.1.2 | NFR-1 | Subprocess use (`git rev-parse` in git-guard, `git status --porcelain` in changelog-guard) uses only Node's built-in `child_process` | `pre-bash-git-guard.js`, `stop-changelog-guard.js` source | Grep for any non-`child_process` process-spawning import | None found |
| 15.1.3 | NFR-2 (critical — the wrapper is modified this feature) | `hooks/lib/run-hook.js`, in its entirety, including the new FR-1.6–FR-1.10 deny-serialization logic, still parses under the declared ES5 syntax floor | `hooks/lib/run-hook.js` post-modification | Run a syntax-only parse (not execution) targeting the declared minimum Node version | Parse succeeds cleanly; no arrow functions, template literals, `const`/`let`, destructuring, optional chaining, or `async`/`await` anywhere in the file — a single `SyntaxError` anywhere would prevent the version gate itself from ever running |
| 15.1.4 | NFR-2 (contrast — guard handlers may use modern syntax) | The 6 new guard handler modules, `require`'d only after the gate passes, are not held to the ES5 floor | Any guard handler source file | Confirm modern syntax (`const`, arrow functions, destructuring, `async`/`await`) is present and unproblematic | No syntax-floor violation flagged — these files are separate from `run-hook.js` and load after the gate |
| 15.1.5 | NFR-3 | A project without the plugin installed, run with `SDLC_HOOKS_ENABLED=0`, or run with all 6 guard ids disabled, behaves identically to a Section-7-only installation | Cross-ref Section 9.1.2 (`SDLC_HOOKS_ENABLED=0`) and 9.1.1 (all 6 disabled) | Compare observable outcomes against `hook-infrastructure_test_cases.md`'s own Section 2/5 baseline | No observable behavioral difference beyond the guards themselves — none of Section 7's 3 hooks changes behavior as a result of this feature |
| 15.1.6 | NFR-4, AC-19 | Post-feature hook handler count is exactly 9 | Implementation complete | `ls hooks/handlers/*.js \| wc -l` | Exactly `9` — Section 7's 3 plus this feature's 6; `pre:edit:read-guard`'s dual registration counts as one handler file, not two |
| 15.1.7 | NFR-4 | Agent count remains 13, skill count remains 5 — unchanged from Section 6/7 | `agents/*.md`, `skills/*/SKILL.md` | `ls agents/*.md \| wc -l`; `ls skills/*/SKILL.md \| wc -l` | 13 agents; 5 skills |
| 15.1.8 | NFR-4 (budget headroom) | Total hook count (9) sits under the v4.0 hard budget of ≤12, leaving exactly 3 slots | Cross-ref 15.1.6 | `9 ≤ 12`; `12 - 9 = 3` | Confirmed — 3 hook slots remain for the roadmap's F3/F4/F5, one of which the deferred `pre:edit:gateguard` would consume if a future feature picks it back up |

---

## Use Case to Test Case Traceability Matrix

| Use Case Scenario | Test Cases |
|---|---|
| UC-1 Primary Flow | 2.1.1, 2.1.5, 1.1.1 |
| UC-1-A1 | 2.1.3 |
| UC-1-A2 | 2.1.2 |
| UC-1-A3 | 2.1.4 |
| UC-1-E1 | 1.2.1 |
| UC-1-EC1 | 2.1.5 |
| UC-1-EC2 | 2.1.7 |
| UC-1-B | 2.7.1 |
| UC-2 Primary Flow | 2.2.1 |
| UC-2-A1 | 2.2.2 |
| UC-2-A2 | 2.2.3 |
| UC-2-E1 | 1.2.1 (shared mechanism) |
| UC-2-EC1 | 2.2.4 |
| UC-3 Primary Flow | 2.3.1, 2.3.2 |
| UC-3-A1 | 2.3.3 |
| UC-3-A2 | 2.3.4 |
| UC-3-A3 | 2.3.5 |
| UC-3-E1 | 1.2.1 (shared mechanism) |
| UC-3-EC1 | 2.3.6 |
| UC-3-B | 2.7.2 |
| UC-4 Primary Flow | 2.4.1 |
| UC-4-A1 | 2.4.4 |
| UC-4-A2 | 2.4.3, 2.4.5 |
| UC-4-A3 | 2.4.6 |
| UC-4-E1 | 1.2.1 (shared mechanism) |
| UC-4-EC1 | 2.4.2 |
| UC-5 Primary Flow | 2.5.1 |
| UC-5-A1 | 2.5.5 |
| UC-5-A2 | 2.5.6 |
| UC-5-A3 | 2.5.7 |
| UC-5-E1 | 2.5.2 |
| UC-5-E2 | 2.5.3 |
| UC-5-EC1 | 2.5.4 |
| UC-5-EC2 | (implementation-defined boundary, not asserted — documented, no fixture required per use-case text) |
| UC-6 Primary Flow | 2.6.1 |
| UC-6-A1 | 2.6.3 |
| UC-6-E1 | 1.2.1 (shared mechanism) |
| UC-6-EC1 | 2.6.4 |
| UC-6-EC2 | 2.6.2 |
| UC-7 Primary Flow | 3.1.1 |
| UC-7-A1 | 3.1.2 |
| UC-7-A2 | 3.1.3, 3.1.4 |
| UC-7-A3 | 3.1.5 |
| UC-7-E1 | 1.2.2 |
| UC-7-EC1 | 3.1.6, 3.1.7 |
| UC-7-EC2 | 3.1.8, 3.1.9 |
| UC-7-EC3 | 3.1.10 |
| UC-7-B | 3.1.12 |
| UC-8 Primary Flow | 4.1.1 |
| UC-8-A1 | 4.1.2, 4.1.3 |
| UC-8-A2 | 4.1.4 |
| UC-8-A3 | 4.1.5 |
| UC-8-E1 | 1.2.3 |
| UC-8-EC1 | 4.1.7 |
| UC-8-EC2 | 4.1.6 |
| UC-8-EC3 | 4.1.8 |
| UC-8-EC4 | 4.1.11 |
| UC-8-B | 4.1.13 |
| UC-9 Primary Flow | 5.1.1 |
| UC-9-A1 | 5.1.7, 5.1.9 |
| UC-9-A2 | 5.1.10 |
| UC-9-A3 | 5.1.11 |
| UC-9-E1 | 1.2.4 |
| UC-9-EC1 | 5.1.3, 5.1.4 |
| UC-9-EC2 | 5.1.5, 5.1.6 |
| UC-9-EC3 | 5.1.8 |
| UC-9-EC4 | (documented limitation of regex/structural detection, not fixture-resolved — recorded, no test required per use-case text) |
| UC-10 Primary Flow | 5.2.1 |
| UC-10-A1 | 5.2.4 |
| UC-10-A2 | 5.2.5 |
| UC-10-A3 | 5.2.6 |
| UC-10-A4 | 5.2.7 |
| UC-10-E1 | 1.2.4 (shared mechanism) |
| UC-10-EC1 | 5.2.2, 5.2.3 |
| UC-10-EC2 | (documented limitation, not fixture-resolved) |
| UC-10-EC3 | (independent-findings note, implicitly covered by 5.1/5.2 firing independently) |
| UC-9/10-B | 5.4.2 |
| UC-11 Primary Flow A | 6.1.1, 6.1.2, 1.1.5 |
| UC-11-A1 | 6.1.3, 6.1.4 |
| UC-11-A2 | 6.1.5 |
| UC-11-A3 | 6.1.6 |
| UC-11 Primary Flow B | 6.2.1, 6.2.2, 6.2.3 |
| UC-11-E1 | 1.2.5 |
| UC-11-EC1 | (build-time precondition, not a runtime scenario — recorded, no fixture) |
| UC-11-EC2 | (mutual-exclusivity design note — Sections 6.1/6.2 documented as alternatives, not both testable against one shipped build) |
| UC-11-EC3 | 6.1.7, 6.2.4 |
| UC-11-B | 6.3.2, 6.3.3 |
| UC-12 Primary Flow | 7.1.1, 1.1.6 |
| UC-12-A1 | 7.2.1 |
| UC-12-A2 | 7.2.2 |
| UC-12-A3 | 7.2.3, 7.2.4 |
| UC-12-A4 | 7.2.5 |
| UC-12-E1 | 7.1.4 |
| UC-12-E2 | 7.1.5 |
| UC-12-E3 | 7.3.1 |
| UC-12-E4 | 1.2.6 |
| UC-12-EC1 | 7.4.2 |
| UC-12-EC2 | 7.3.2 |
| UC-12-EC3 | 7.4.3 |
| UC-12-B | 7.4.4 |
| **UC-13 (and all its sub-flows/edge cases)** | **DEFERRED — `pre:edit:gateguard` is out of scope for this feature (PRD Design Decision 9, 8.10 Risk 4). No positive test cases exist. See Section 8 for the confirmation suite proving the deferral holds mechanically.** |
| UC-14 Primary Flow | 1.2.1–1.2.6 |
| UC-14-A1 | 1.2.6 |
| UC-14-A2 | 1.2.2, 1.2.7 |
| UC-14-A3 | 1.2.8 |
| UC-14-E1 | 1.4.1–1.4.5 (malformed-deny dropped) plus every 1.2.x row's absence assertion |
| UC-14-EC1 | 1.2.9 |
| UC-14-EC2 | (independent-outcome design note across guards — implicitly demonstrated by any two guards' fixtures being run against the same tool call in Section 9's kill-switch sweep context) |
| UC-15 Primary Flow | 9.1.1 |
| UC-15-A1 | 9.1.2 |
| UC-15-A2 | 9.1.3 |
| UC-15-A3 | (not applicable — `pre:edit:gateguard` deferred; see UC-13 row) |
| UC-15-E1 | 9.1.4 |
| UC-15-EC1 | 9.1.5 |
| UC-15-EC2 | 9.1.6 |
| UC-16 Primary Flow | 12.1.1, 12.1.2 |
| UC-16-A1 (superseded) | 1.1.1–1.1.6 (runtime positive control replaces the source-grep this scenario originally described, per FR-10.2) |
| UC-16-E1 (superseded) | 1.1.1–1.1.6 (a future stripped deny path now fails the runtime fixture, not a grep) |
| UC-16-E2 | 12.1.3 |
| UC-16-E3 | 12.1.4 |
| UC-16-EC1 | 12.1.5, 12.1.6 |
| UC-17 Primary Flow | 14.1.1 |
| UC-17-A1 | 14.1.2 |
| UC-17-E1 | 14.1.3 |
| UC-17-E2 | 14.1.4 |
| UC-17-E3 | 14.1.5 |
| UC-17-EC1 | 14.1.6 |
| UC-17-EC2 | 14.1.7 |

### FR/AC Cross-Reference (structural requirements not tied to a single UC)

| Requirement | Test Cases |
|---|---|
| FR-1.6–FR-1.10 (wrapper deny channel) | Section 1 in full |
| FR-9.1/FR-9.2 (single blocking mechanism per event type) | 1.1.1–1.1.6 (shape confirmed per guard) |
| FR-9.3 (all 6 ids valid `SDLC_DISABLED_HOOKS` targets) | 9.1.7 |
| FR-9.4 (one scoped escape sentinel per guard) | 2.1.4, 2.2.3, 2.3.5, 2.4.6, 2.5.7, 2.6.3, 3.1.5, 4.1.5, 5.1.11, 5.2.6, 6.1.5, 7.2.5 |
| FR-9.5 (concrete, self-sufficient remedy) | 10.1.8, 10.1.9 |
| FR-9.6 (literal deviation-rule token) | 10.1.1–10.1.7 |
| FR-9.7 (no self-granted exceptions) | 11.1.1–11.1.3 |
| FR-9.8 (exit code 2 never used) | 1.5.1, 1.5.2, 12.1.1 |
| FR-10.1–FR-10.4 (CI sweep narrowing, runtime deny verification, ordering) | Sections 12, 13 |
| FR-11.1/FR-11.2 (autonomy regression) | Section 14 |
| NFR-1–NFR-4 (dependencies, syntax floor, backward compatibility, asset budget) | Section 15 |
| AC-1 | 2.1.1, 2.1.3 |
| AC-2 | 2.2.1, 2.2.2 |
| AC-3 | 2.3.1, 2.3.2, 2.3.3 |
| AC-4 | 2.4.1, 2.4.4 |
| AC-5 | 2.5.1, 2.5.2, 2.5.5 |
| AC-6 | 2.6.1, 2.6.3, 2.6.4 |
| AC-7 | 3.1.1, 3.1.2, 3.1.5 |
| AC-8 | 4.1.1, 4.1.2, 4.1.4 |
| AC-9 | 5.1.1, 5.1.11, 5.2.1, 5.2.6 |
| AC-10 | 5.3.1–5.3.4 |
| AC-11 | 6.1.1, 6.1.3, 6.2.1, 6.2.2 |
| AC-12 | 7.1.1, 7.2.1, 7.2.3, 7.3.1 |
| AC-13 | 10.1.1–10.1.9 |
| AC-14 | Section 1.1, Section 1.2 |
| AC-15 | Section 1.3 |
| AC-16 | 12.1.1, 12.1.2 |
| AC-17 | 9.1.1 |
| AC-18 | Section 14 |
| AC-19 | 8.1.2, 15.1.6 |
| AC-20 | 13.1.1, 13.1.2 |
