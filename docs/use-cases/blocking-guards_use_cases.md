# Use Cases: Blocking Guards

> Based on [PRD](../PRD.md) — Section 8: Blocking Guards

**System context (do not assume otherwise):** This feature has no UI, no server, and no database — identical in kind to `hook-infrastructure_use_cases.md` (Section 7), whose I/O contract, `run-hook.js` wrapper, and fail-open contract this document inherits **unmodified** and does not restate in full. What changes here is narrow and specific: Section 7 shipped exactly 3 hooks, none of which was ever permitted to exit `2` or set a `permissionDecision`/`decision` field (see `hook-infrastructure_use_cases.md` UC-3's explicit "No hook shipped by this feature is ever permitted to exit `2`... Only Section 8 ... will ever introduce a `2` exit anywhere in this harness"). This document is that follow-on: 7 new hook ids, dispatched through the same `hooks/lib/run-hook.js`, that gain the ability to refuse a tool call outright. Actors are: **Claude Code** (spawns each guard's process, honours its exit code, and — for a `deny`/`block` decision — feeds the reason back into the model's own turn instead of applying the tool call), the **Developer** (whose autonomous run is blocked or allowed to proceed), and, for one specific guard (`pre:agent:isolation-guard`), **parallel-wave subagents** as a distinct actor class whose tool calls must be distinguishable from the orchestrator's own. Every scenario below has a mechanically checkable outcome: an exit code, a `permissionDecision`/`decision` value, a specific substring in the deny/block reason, or the presence/content/absence of a state file under `.claude/tmp/`.

**The organizing principle of this document, per the task that produced it:** for every guard, the block case and the allow case are documented in equal depth. A guard that refuses legitimate work stalls an unattended pipeline — worse than the rule it was meant to enforce — so every UC below carries at least as many allow-side flows as block-side ones.

---

## Blocking I/O Contract (referenced throughout, do not restate per use case)

- **stdin**: identical envelope to Section 7 (`session_id`, `transcript_path`, `cwd`, `hook_event_name`), plus event-specific fields already documented in `hook-infrastructure_use_cases.md`'s own contract section: `PreToolUse` carries `tool_name`, `tool_input`; the `PostToolUse`-registered recorder half of `pre:edit:read-guard` carries `tool_name`, `tool_input`, `tool_response`; `Stop` carries `stop_hook_active`.
- **Two block-signaling shapes, per FR-9.1 (`PreToolUse` guards: `pre:bash:git-guard`, `pre:write:shrink-guard`, `pre:edit:read-guard`, `pre:edit:config-protection`, `pre:agent:isolation-guard`'s FR-6.2 branch, `pre:edit:gateguard`) — a guard MUST use exactly one, never a third shape:**
  - **(a) exit code `2`**, with the deny reason written to stderr (fed back to the model as the block reason by Claude Code's own hook engine), or
  - **(b) exit code `0`**, with stdout JSON:
    ```json
    {
      "continue": true,
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "<reason, always ending in a concrete remedy per FR-9.5>"
      }
    }
    ```
- **One block-signaling shape, per FR-9.2 (the `Stop` guard, `stop:changelog-guard`):**
  - **(a) exit code `2`** with the reason on stderr, or
  - **(b) exit code `0`** with stdout JSON `{"continue": true, "decision": "block", "reason": "<reason>"}` — this forces Claude Code into another turn instead of ending the response; it is not a `Write`/`Edit` denial, because by the time `Stop` fires the write already happened (Design Decision 5, FR-7.4).
- **Allow signaling**: exit `0`, with **no** `permissionDecision`/`decision` field present in stdout at all (an omitted field, not `"permissionDecision": "allow"`). This is mechanically indistinguishable, at the exit-code level, from a call the guard's own matcher never examined in the first place (e.g., a `Bash` command that isn't `git commit`/`git push`/`git add -A|.`, or a `Write` outside the curated set) — both are "the tool call proceeds exactly as if the guard had not fired."
- **Fail-open is unchanged from Section 7 and governs mechanism failure only (FR-1.2):** a guard handler that throws, times out, or cannot run under a satisfying Node version MUST still result in `run-hook.js` exiting `0` with **no** `permissionDecision`/`decision` field — i.e., under blocking semantics, "fail-open" literally means **"allow."** A `systemMessage` naming the hook id and the Section 7 canonical reason token (`exception`, `timeout`, `node-unavailable`) is emitted exactly as in `hook-infrastructure_use_cases.md` UC-3; no scenario in this document ever produces a `deny`/`block` as a side effect of a crash (FR-1.3).
- **The fail-closed layer for irreversible actions is `permissions.deny` (Section 7 FR-7), not any guard in this document.** `git push --force`, `git reset --hard`, and `git filter-branch` are refused by Claude Code itself, before any hook process spawns, regardless of any guard's own escape sentinel (FR-1.4). No guard in this document re-implements that check.

### Guard Reference Table

| Guard id | Event / matcher | FR range | Scoped escape sentinel | Backstop gate |
|---|---|---|---|---|
| `pre:bash:git-guard` | `PreToolUse` / `Bash` | FR-2 | `SDLC_ALLOW_GIT_GUARD=1` | Gate 0 (Git Hygiene) |
| `pre:write:shrink-guard` | `PreToolUse` / `Write` | FR-3 | `SDLC_ALLOW_SHRINK=1` | Gate 1 (Documentation Completeness) |
| `pre:edit:read-guard` | `PostToolUse`/`Read` (records) + `PreToolUse`/`Edit\|Write` (gates), one id, two registrations | FR-4 | `SDLC_ALLOW_UNREAD_EDIT=1` | Gate 4 (Build Verification) |
| `pre:edit:config-protection` | `PreToolUse` / `Edit\|Write` | FR-5 | `SDLC_ALLOW_CONFIG_EDIT=1` | Gate 2 (Code Review) |
| `pre:agent:isolation-guard` | `PreToolUse` / `Edit\|Write`, subagent context | FR-6 | `SDLC_ALLOW_SUBAGENT_WRITE=1` (FR-6.2 branch only) | Changelog idempotency guard, then Gate 0 |
| `stop:changelog-guard` | `Stop` | FR-7 | `SDLC_ALLOW_CHANGELOG_SHAPE=1` | merge-ready's changelog finalization step |
| `pre:edit:gateguard` | `PreToolUse` / `Edit\|Write`, opt-in | FR-8 | none — self-clearing (FR-8.4) + `SDLC_DISABLED_HOOKS` | Gate 2 and Gate 6 (Goal-Backward Verification) |

Every guard is additionally disableable in full via `SDLC_DISABLED_HOOKS` (its own id, comma-separated with others) and, upstream of that, via the global `SDLC_HOOKS_ENABLED=0` kill switch — both inherited unmodified from Section 7 FR-4.2/FR-4.3 (UC-15 below). `pre:edit:gateguard` additionally requires the literal opt-in token `SDLC_GATEGUARD=on` before any of its logic runs at all (FR-8.1, FR-8.5) — it is off by default, unlike the other 6.

---

## UC-1: `pre:bash:git-guard` — Never Commit on `main`/`master`

**Actor**: Claude Code; Developer
**Preconditions**: `pre:bash:git-guard` is registered and not suppressed (UC-15); the `Bash` command under evaluation is, or compounds, a `git commit`
**Trigger**: A `Bash` tool call whose `command` field is or contains `git commit`

### Primary Flow (Block — Committing on `main`)
1. The repository's current branch, resolved via `git rev-parse --abbrev-ref HEAD` run in the `cwd` from `PreToolUse` stdin, is `main`.
2. The model issues `Bash` with `command: "git commit -m \"feat(core): x\""`.
3. `pre:bash:git-guard` matches the command against its `git commit` inspection set (FR-2.1), resolves the branch, and finds it is `main`.
4. The guard denies: `permissionDecisionReason` (or stderr, under the exit-`2` shape) contains the branch name and a concrete remedy — e.g. "on branch `main`; create/switch to a feature branch: `git checkout -b feat/<slug>`" (AC-1).
5. Claude Code does not execute the commit; the reason is fed back into the model's turn.
6. **Mechanically checkable outcome**: exit `2` (stderr contains `main` and `git checkout -b`) OR exit `0` with `permissionDecision: "deny"` and `permissionDecisionReason` containing the same substrings.

**Postconditions**: No commit is created on `main`; the working tree is unchanged; the model's own retry (switching branches) is classifiable as Rule 1/2 under `src/rules/error-recovery.md` (FR-9.6) — free, no escalation.

### Alternative Flows (Allow)
- **UC-1-A1: The identical command on a feature branch (AC-1)** — current branch is `feat/hook-infrastructure` (or any non-`main`/`master` name). Step 3 resolves the branch, finds it is neither `main` nor `master`, and the guard does not deny — exit `0`, no `permissionDecision` field, the commit proceeds. This is the single most common path through this guard during a normal `/implement-slice` run and MUST be exercised at least as often as the block case in any fixture suite.
- **UC-1-A2: `master` is denied identically to `main`** — the branch-name check covers both literal names (FR-2.2); a repository whose default branch is `master` gets the same deny reason, substituting the resolved name.
- **UC-1-A3: `SDLC_ALLOW_GIT_GUARD=1` is set for the call (FR-2.10)** — the same command on `main` that would otherwise be denied by step 4 proceeds instead, since the escape sentinel bypasses every check FR-2.2–FR-2.7 governs, not only the branch check. This sentinel is scoped to the one `Bash` call, per FR-9.4 ("a single legitimate exception does not require disabling the guard's other checks").

### Error Flows
- **UC-1-E1: `git rev-parse --abbrev-ref HEAD` itself throws or the `child_process` call fails** (e.g. a corrupted `.git` directory, or the `cwd` is not inside a git repository at all) — this is not a deliberate deny; it is a mechanism failure. Per FR-1.2/FR-1.3, `run-hook.js`'s wrapper catches it, exits `0` with **no** `permissionDecision` field, and emits a `systemMessage` naming `pre:bash:git-guard` and reason `exception`. The commit proceeds unchecked for this one call — see UC-14 for the full fail-open treatment.

### Edge Cases
- **UC-1-EC1**: A compound command, e.g. `cd /tmp/scratch && git commit -m "feat(core): x"` — FR-2.1 requires the guard to inspect commands that *contain* `git commit` as part of a compound (`&&`, `;`, `|`), not only bare invocations; the guard still resolves the branch from `cwd` (not from the `cd` target inside the string, since FR-2.2 names `PreToolUse` stdin's own `cwd` field as the resolution source) — a fixture MUST confirm the guard is not fooled by a leading directory change inside the command string into skipping the check.
- **UC-1-EC2**: `SDLC_DISABLED_HOOKS` contains `pre:bash:git-guard` — the guard's handler logic never runs at all (Section 7 FR-4.3 precedent); a commit on `main` proceeds unexamined, identically to UC-15's cross-guard kill-switch scenario, and Gate 0 (below) is the only thing standing between this and a merged `main`-branch commit.

### Data Requirements
- **Input**: `PreToolUse` stdin's `command`, `cwd`; the live output of `git rev-parse --abbrev-ref HEAD`
- **Output**: `deny` (exit `2` or `permissionDecision: "deny"`) naming the branch and the `git checkout -b` remedy, or silent proceed
- **Side Effects**: None from the guard itself — no file written, no git state changed; a subprocess (`git rev-parse`) is spawned read-only

---

## UC-1-B: `pre:bash:git-guard` → Gate 0 Backstop When the Guard Is Disabled

**Actor**: Developer; `merge-ready`'s Gate 0 (Git Hygiene)
**Preconditions**: `SDLC_DISABLED_HOOKS` includes `pre:bash:git-guard` (or the guard mechanism-failed on every `git commit` call for the session, per UC-1-E1) for the duration of a slice
**Trigger**: `/merge-ready` runs after implementation, with a commit having landed on `main` (or a bulk-staged commit, UC-3's invariant) undetected at commit time

### Primary Flow
1. With the guard suppressed, a `git commit` on `main` was never denied during the session (UC-1-EC2).
2. `/merge-ready` runs its quality gates; **Gate 0 (Git Hygiene)** checks "on feature branch," "working tree clean," "all slice commits present" against the actual repository state, independent of whether `pre:bash:git-guard` ran at all (FR-2.9).
3. Gate 0 finds the branch is `main` (or the relevant commit-integrity invariant violated) and fails, blocking `MERGE READY`.

**Postconditions**: The `main`-branch commit is caught before merge even though the runtime guard never fired — this is what makes the guard's fail-open tolerance and disableability acceptable per Section 7 FR-3.7/this feature's FR-1.1.

### Data Requirements
- **Input**: The repository's actual branch and commit history at merge-ready time
- **Output**: Gate 0 PASS/FAIL, independent of any hook's runtime behavior during the session
- **Side Effects**: None — a re-check, not a mutation

---

## UC-2: `pre:bash:git-guard` — No `--no-verify` on `git commit`

**Actor**: Claude Code; Developer
**Preconditions**: Same as UC-1
**Trigger**: A `Bash` tool call is or contains `git commit` with a `--no-verify` (or unambiguous `-n`) argument

### Primary Flow (Block)
1. Model issues `git commit --no-verify -m "feat(core): x"` on a feature branch.
2. The guard's branch check (UC-1) passes (feature branch), but the argument scan (FR-2.3) finds `--no-verify`.
3. Deny: reason names `--no-verify` explicitly and instructs removing it (AC-2).
4. **Mechanically checkable outcome**: deny with a reason containing `--no-verify`; the commit is not executed.

**Postconditions**: Pre-commit hooks (typecheck/format, if any project-level git hooks exist) are never bypassable by this route.

### Alternative Flows (Allow)
- **UC-2-A1: The identical command without `--no-verify` (AC-2)** — `git commit -m "feat(core): x"` on a feature branch passes this check (and, per UC-1-A1, the branch check) — not denied.
- **UC-2-A2: `SDLC_ALLOW_GIT_GUARD=1` set** — proceeds even with `--no-verify` present, per the same session-scoped escape as UC-1-A3.

### Error Flows
- **UC-2-E1**: Same fail-open contract as UC-1-E1 — a handler exception during argument parsing (e.g. malformed quoting in the command string that the parser cannot tokenize) MUST still result in exit `0`, no deny, `systemMessage` reason `exception` — never a deny synthesized from a parse failure.

### Edge Cases
- **UC-2-EC1**: `-n` used as the short form — FR-2.3 explicitly defers the exact token-match rule to the planner during `/bootstrap-feature` "to avoid colliding with an unrelated `-n` flag on a different subcommand" (e.g. `git log -n 5` inside an unrelated compound command). This document records the ambiguity as intentional and not resolved at the use-case level; QA test cases derived from this UC MUST assert against whatever exact matching rule the planner records, and MUST include a negative fixture proving an unrelated `-n` elsewhere in the command string does not false-positive.

### Data Requirements
- **Input**: The full argument list of the matched `git commit` invocation
- **Output**: `deny` naming `--no-verify`, or silent proceed
- **Side Effects**: None

---

## UC-3: `pre:bash:git-guard` — No Bulk Staging (`git add -A` / `git add .`)

**Actor**: Claude Code; Developer
**Preconditions**: Same as UC-1
**Trigger**: A `Bash` tool call whose `command` is exactly `git add -A` or `git add .` (with or without trailing path separator)

### Primary Flow (Block)
1. Model issues `Bash` with `command: "git add -A"`.
2. The guard matches this against FR-2.4's exact-match rule and denies — reason names the bulk-add shape and instructs staging specific paths instead (AC-3).
3. **Mechanically checkable outcome**: deny with a reason mentioning `git add -A`/`git add .` and a remedy naming `git add <path>`.

**Postconditions**: No bulk stage occurs; nothing is added to the index by this call.

### Alternative Flows (Allow)
- **UC-3-A1: `git add path/to/file.js` (AC-3)** — a specific-path add is not an exact match for FR-2.4's denied shapes; not denied, proceeds normally. This is the guard's intended everyday path during `/implement-slice`, where the planner's own workflow stages only the files a slice actually touched.
- **UC-3-A2: `git add . src/index.js` or other non-exact variants** — FR-2.4 denies the command only when it is *exactly* `git add -A` or `git add .` (with/without trailing separator); a command with additional arguments beyond the bare bulk-add token is not the literal denied shape and is not covered by this specific check — mirrors FR-2.4's own "exactly" wording. (Such a compound-argument invocation is unusual in practice; this alternative flow documents the literal boundary of the match, not a recommended pattern.)
- **UC-3-A3: `SDLC_ALLOW_GIT_GUARD=1` set** — the identical bulk-add command proceeds.

### Error Flows
- **UC-3-E1**: Fail-open contract, identical shape to UC-1-E1.

### Edge Cases
- **UC-3-EC1**: `git add -A .` or `git add --all` — variant spellings of the same intent not literally matching FR-2.4's two named shapes. This is a known limitation of literal pattern matching (mirrors `hook-infrastructure_use_cases.md` UC-9-EC2's precedent for `permissions.deny`'s own obfuscation limitation) — not a defect specific to this feature, and not required to be closed by FR-2.4's text.

### Data Requirements
- **Input**: The exact `command` string
- **Output**: `deny` naming the bulk-add shape, or silent proceed
- **Side Effects**: None

---

## UC-3-B: `pre:bash:git-guard` (Bulk-Add Check) → Gate 0 Backstop

**Actor**: Developer; `merge-ready`'s Gate 0
**Preconditions**: `pre:bash:git-guard` disabled or mechanism-failed on a `git add -A` call
**Trigger**: A bulk-staged, unreviewed commit reaches `/merge-ready`

### Primary Flow
1. With the guard suppressed, `git add -A` stages every changed file in the working tree, including files unrelated to the current slice.
2. The resulting commit is created; the guard never examined the staging command.
3. Gate 0's "all slice commits present" check (FR-2.9) cross-references the commit's file list against the slice's declared `Files:` scope from the plan and flags an unaccounted-for file, failing the gate.

**Postconditions**: An over-broad commit is caught before merge, not silently accepted.

### Data Requirements
- **Input**: The commit's actual file list vs. the plan's declared scope for the slice
- **Output**: Gate 0 PASS/FAIL
- **Side Effects**: None

---

## UC-4: `pre:bash:git-guard` — No AI Attribution in Commit Messages

**Actor**: Claude Code; Developer
**Preconditions**: Same as UC-1; mechanizes `src/rules/git.md`'s "NEVER add 'Co-Authored-By' or any AI attribution to commit messages"
**Trigger**: A `git commit` whose `-m` message argument(s) contain, case-insensitively, `Co-Authored-By` or another AI-attribution phrase named in `src/rules/git.md`/`templates/CLAUDE.md`

### Primary Flow (Block)
1. Model issues `git commit -m "feat(core): x\n\nCo-Authored-By: Claude <noreply@anthropic.com>"`.
2. FR-2.5's case-insensitive scan of the `-m` argument(s) finds `Co-Authored-By`.
3. Deny: reason names the attribution phrase found and instructs removing it — the commit message MUST contain only the change description (AC-4).
4. **Mechanically checkable outcome**: deny reason contains `Co-Authored-By` (or the matched phrase) case-insensitively; commit not executed.

**Postconditions**: No AI-attributed commit lands in history.

### Alternative Flows (Allow)
- **UC-4-A1: The identical message without the attribution line (AC-4)** — `git commit -m "feat(core): x"` is not denied by this check.
- **UC-4-A2: Case variance** — `co-authored-by`, `CO-AUTHORED-BY`, mixed case — all match per FR-2.5's explicit case-insensitivity; this is a block-side variant included here because the negative-space assertion (a message that does NOT contain any casing of the phrase is never falsely flagged) is the allow-side guarantee that matters for QA — a message merely containing the word "Claude" in an unrelated, legitimate context (e.g. `fix(core): rename ClaudeConfig to AgentConfig`) is a genuine tension the guard's phrase list must be scoped carefully to avoid; this document records it as a required negative fixture, not a resolved ambiguity — FR-2.5 names "mentions of 'Claude' or 'AI' as an author/co-author," not any occurrence of the bare word, and the planner's exact phrase-matching rule during `/bootstrap-feature` MUST be narrow enough to pass `fix(core): rename ClaudeConfig to AgentConfig` while still catching `Co-Authored-By: Claude`.
- **UC-4-A3: `SDLC_ALLOW_GIT_GUARD=1` set** — the attributed message proceeds (this remains a legitimate override path only in the sense that the escape exists uniformly across FR-2.2–FR-2.7; ordinary pipeline operation is never expected to need it for this specific check).

### Error Flows
- **UC-4-E1**: Fail-open contract, identical shape to UC-1-E1 (a regex-engine exception on unusual message content still exits `0`, no deny).

### Edge Cases
- **UC-4-EC1**: A multi-line `-m` message where the attribution phrase appears in a later line (as in the primary flow's example, a trailing `Co-Authored-By:` footer) rather than the first line — the scan MUST cover the full message content passed to `-m`, not merely its first line, since AI-attribution footers are conventionally appended, not prepended.

### Data Requirements
- **Input**: The full `-m` message content (all `-m` arguments if multiple are given)
- **Output**: `deny` naming the matched phrase, or silent proceed
- **Side Effects**: None

---

## UC-5: `pre:bash:git-guard` — Conventional Commit Shape

**Actor**: Claude Code; Developer
**Preconditions**: Same as UC-1; mechanizes `src/rules/git.md`'s `type(scope): message` convention and its allowed lists (`feat|fix|test|chore` × `api|ui|db|auth|core|infra`)
**Trigger**: A `git commit` whose `-m` message's leading prefix does not parse as `type(scope): ` with `type` in the allowed set and `scope` in the allowed set

### Primary Flow (Block — Disallowed Scope)
1. Model issues `git commit -m "docs(readme): x"`.
2. FR-2.6 parses the leading `type(scope): ` prefix: `type = docs`, `scope = readme` — neither `docs` (not in `feat|fix|test|chore`) nor `readme` (not in `api|ui|db|auth|core|infra`) is allowed; `docs` alone is sufficient to deny.
3. Deny: reason names the specific token that failed (`docs` is not an allowed type) and lists the allowed set (AC-5).
4. **Mechanically checkable outcome**: deny reason contains `docs` and the literal allowed-type list `feat|fix|test|chore`.

**Postconditions**: No non-conventional commit lands in history.

### Alternative Flows (Allow)
- **UC-5-A1: `git commit -m "feat(core): x"` (AC-5)** — `type = feat` (allowed), `scope = core` (allowed) — not denied. This is the guard's everyday allow path and MUST be the dominant fixture case, since every legitimate slice commit in this repository's own convention (`src/rules/git.md`) takes this exact shape.
- **UC-5-A2: Every other allowed combination** — `fix(api): ...`, `test(db): ...`, `chore(infra): ...`, `feat(auth): ...`, `fix(ui): ...` — all pass; a complete fixture matrix crosses all 4 types × all 6 scopes (24 combinations) to confirm none is spuriously denied.
- **UC-5-A3: `SDLC_ALLOW_GIT_GUARD=1` set** — a non-conventional message proceeds regardless.

### Error Flows
- **UC-5-E1: Disallowed type, allowed scope** — `git commit -m "refactor(core): x"` — `type = refactor` is not in `feat|fix|test|chore` even though `scope = core` is allowed; denied, reason names `refactor` as the disallowed type (AC-5's second example).
- **UC-5-E2: No parseable `type(scope):` prefix at all** — `git commit -m "fix stuff"` has no `(scope):` structure at all. Per FR-2.6's explicit clause ("A message with no parseable `type(scope):` prefix at all MUST also be denied — an unparseable prefix is not conforming by omission"), this is denied, not silently passed through as "not our concern." Reason states the message does not match the required `type(scope): message` shape and shows the expected form.

### Edge Cases
- **UC-5-EC1**: A scope containing extra characters or nested parens, e.g. `feat(core/db): x` — not a literal match for any single allowed scope token; denied per FR-2.6's exact-match reading, even though a human might read this as a reasonable compound scope. QA test cases MUST assert this is denied unless the planner's exact parsing rule (finalized during `/bootstrap-feature`) explicitly special-cases compound scopes — this document does not assume that special case exists, since FR-2.6 states the scope list "exactly."
- **UC-5-EC2**: Leading/trailing whitespace inside the `type(scope):` prefix, e.g. `feat( core ): x` — a strict parser could plausibly deny this as unparseable per UC-5-E2's rule even though a human would read intent clearly; this is recorded as an implementation-defined boundary, not a resolved allow/deny in this document, mirroring UC-2-EC1's treatment of the `-n` ambiguity.

### Data Requirements
- **Input**: The `-m` message's leading substring up to the first `: `
- **Output**: `deny` naming the specific failing token (type or scope) and the allowed lists, or silent proceed
- **Side Effects**: None

---

## UC-6: `pre:bash:git-guard` — Push Requires Explicit Request

**Actor**: Claude Code; Developer
**Preconditions**: Same as UC-1; mechanizes `src/rules/git.md`'s "do NOT push unless explicitly asked"; distinct from `permissions.deny`'s own, separate coverage of force-push/history-rewrite (FR-1.4/FR-2.8)
**Trigger**: A `Bash` tool call that is a plain `git push` not already covered by an existing `permissions.deny` entry

### Primary Flow (Block — Unrequested Push)
1. Model, mid-`/implement-slice`, issues `git push` without the user's message having asked for a push in this session.
2. FR-2.7 checks whether `SDLC_ALLOW_GIT_GUARD=1` is set for this call; it is not.
3. Deny: reason states the pipeline's own rule ("do NOT push unless explicitly asked") and the exact remedy — set `SDLC_ALLOW_GIT_GUARD=1` immediately before the push, and only when the user's message explicitly requested it (AC-6).
4. **Mechanically checkable outcome**: deny reason names `SDLC_ALLOW_GIT_GUARD` and the "explicitly asked" condition; the push does not occur.

**Postconditions**: No remote branch state changes without deliberate, session-scoped model intent to push.

### Alternative Flows (Allow)
- **UC-6-A1: `SDLC_ALLOW_GIT_GUARD=1` set immediately before the push, following an explicit user request (AC-6)** — the identical `git push` proceeds. This is the legitimate everyday allow path: the model sets the sentinel deliberately, per FR-2.7's own text, only in direct response to an explicit ask.

### Error Flows
- **UC-6-E1: Fail-open** — identical shape to UC-1-E1.

### Edge Cases
- **UC-6-EC1: `git push --force` with `SDLC_ALLOW_GIT_GUARD=1` set (AC-6's second clause)** — `permissions.deny` (Section 7 FR-7.1) refuses this at the fail-*closed* permission layer, before any hook process spawns at all; `pre:bash:git-guard`'s own escape sentinel has no effect on a check that isn't this guard's to make (FR-1.4/FR-2.8). **Mechanically checkable outcome**: the push is refused by Claude Code's permission engine regardless of `SDLC_ALLOW_GIT_GUARD`'s value — a fixture asserting this MUST NOT invoke `pre:bash:git-guard`'s own test harness at all, since the refusal happens upstream of it.
- **UC-6-EC2**: A plain `git push origin feat/hook-infrastructure` (with explicit remote/branch, not force) — still a plain push shape for FR-2.7's purposes; same block/allow behavior as the bare `git push` case in the primary flow.

### Data Requirements
- **Input**: The `command` string; `SDLC_ALLOW_GIT_GUARD` from the environment at call time
- **Output**: `deny` naming the escape sentinel and the "explicitly asked" condition, or silent proceed when the sentinel is set
- **Side Effects**: None from the guard; the push itself (when allowed) is the developer's/model's own git operation

---

## UC-7: `pre:write:shrink-guard` — Curated File Shrink-Ratio Protection

**Actor**: Claude Code; Developer
**Preconditions**: `pre:write:shrink-guard` registered, not suppressed; target of a `Write` call resolves to one of `.claude/scratchpad.md`, `docs/PRD.md`, `docs/use-cases/*`, `docs/qa/*`, `CHANGELOG.md` (FR-3.1)
**Trigger**: A `Write` tool call against a curated path

### Primary Flow (Block — A `Write` That Guts a Curated File)
1. `docs/PRD.md` currently has `oldLines = 1600`.
2. The model issues a `Write` to `docs/PRD.md` whose content is `newLines = 200` — a truncated summary replacing the full document (e.g. a model that "summarized" instead of preserving full content mid-compaction).
3. The guard computes `threshold = max(1600 × 0.4, 40) = 640`. `200 < 640` → deny.
4. Reason states `oldLines: 1600`, `newLines: 200`, `threshold: 640`, and the remedy: write the intended content in full, or set `SDLC_ALLOW_SHRINK=1` if the shrink is deliberate (FR-3.6).
5. **Mechanically checkable outcome**: deny reason contains the three numeric values and both remedy phrases; the file on disk is unchanged.

**Postconditions**: The curated document's prior content survives on disk exactly as it was before the call.

### Alternative Flows (Allow)
- **UC-7-A1: A `Write` that grows the file** — `oldLines = 1600`, `newLines = 1650` (a new section appended via full-file `Write`, not an `Edit`). `1650 ≥ 640` → not denied (FR-3.4's explicit "including any `Write` that grows the file" clause). This, and UC-7-A2/A3 below, are the guard's everyday paths and MUST outnumber the block fixture in any suite exercising this guard, since curated documents grow far more often than they legitimately shrink.
- **UC-7-A2: A `Write` to a path outside the curated set** — e.g. `src/handlers/foo.js`, or `docs/architecture.md` (not matching any of the 5 curated globs) — FR-3.1's own matcher never fires; the guard performs no computation at all, mechanically identical to `hook-infrastructure_use_cases.md` UC-1-A2's "matcher does not match" non-event.
- **UC-7-A3: `SDLC_ALLOW_SHRINK=1` set for the call** — the identical 1600→200-line `Write` from the primary flow proceeds, since the escape bypasses FR-3.3 entirely for that one call (FR-3.5) — the legitimate case named in FR-3.6's own remedy text: "removing a superseded section."

### Error Flows
- **UC-7-E1: Fail-open** — the guard's own line-count computation throws (e.g. the on-disk file cannot be read due to a permissions error unrelated to this feature) — exit `0`, no deny, `systemMessage` reason `exception`, the `Write` proceeds unchecked for this one call (see UC-14).

### Edge Cases
- **UC-7-EC1 (the `oldLines < 40` boundary, explicitly flagged by FR-3.3 as requiring its own dedicated fixture rather than an assumed answer):** A curated file is itself short, e.g. `docs/qa/foo_test_cases.md` currently has `oldLines = 25` (a stub, or an unusually terse file). The formula's threshold is `max(25 × 0.4, 40) = 40` regardless of how small `oldLines` is, because the floor of `40` dominates whenever `oldLines < 100`. A `Write` that keeps the file at `newLines = 25` (an unchanged rewrite, or a modest edit that does not reach 40 lines) evaluates to `25 < 40` under the literal formula — **denied**, even though nothing was proportionally "shrunk" relative to the file's own prior size. FR-3.3's own text states this exact case "MUST be covered by a dedicated fixture test rather than left to interpretation during implementation" — this document records the tension precisely rather than resolving it: a fixture MUST exist that exercises `oldLines < 40`, and its expected outcome (deny, matching the literal formula as written above) is the one this document treats as authoritative absent a later architect/planner revision, since FR-3.3 gives no alternate formula for this branch. A short curated file therefore cannot be `Write`-rewritten below 40 lines without either growing it to ≥40 lines or setting `SDLC_ALLOW_SHRINK=1` — this is the one guard-behavior detail in this document not fully derivable from PRD prose alone, flagged here so QA encodes it explicitly rather than assuming either outcome silently.
- **UC-7-EC2**: A brand-new curated file (`oldLines = 0`, per FR-3.2's explicit "`0` if the file does not yet exist") — threshold is `max(0, 40) = 40`; a first `Write` creating, e.g., a new `docs/use-cases/<feature>_use_cases.md` with `newLines = 35` is denied by the same floor-40 mechanism as UC-7-EC1, while one with `newLines ≥ 40` (this very document, well over 40 lines) is not. This is the same edge case as UC-7-EC1 with `oldLines` fixed at its minimum value, included separately because "file does not exist yet" and "file exists but is short" are different preconditions a fixture must distinguish.
- **UC-7-EC3**: `Edit` calls against curated files are entirely outside this guard's scope — FR-3.1 names only `Write`; an `Edit` that shrinks `docs/PRD.md` by deleting a large block is not inspected by `pre:write:shrink-guard` at all (it may be inspected by `pre:edit:read-guard`, UC-8, for an unrelated reason — whether the file was read first — but not for its resulting size).

### Data Requirements
- **Input**: The curated file's current on-disk line count; the `Write` call's proposed content's line count
- **Output**: `deny` naming `oldLines`, `newLines`, `threshold`, and both remedies, or silent proceed
- **Side Effects**: None from the guard; a denied `Write` never touches disk

---

## UC-7-B: `pre:write:shrink-guard` → Gate 1 Backstop

**Actor**: Developer; `merge-ready`'s Gate 1 (Documentation Completeness)
**Preconditions**: `pre:write:shrink-guard` disabled or mechanism-failed for a `Write` that gutted `docs/PRD.md`
**Trigger**: `/merge-ready` runs Gate 1

### Primary Flow
1. With the guard suppressed, a `Write` reduced `docs/PRD.md` from 1600 to 200 lines undetected.
2. Gate 1 (FR-3.7) verifies `docs/PRD.md`, `docs/use-cases/*`, and `docs/qa/*` exist and are populated for the feature — a 200-line PRD missing most of its sections fails this population check independent of the shrink-guard's own runtime behavior.
3. Gate 1 fails, blocking `MERGE READY`.

**Postconditions**: A gutted curated document cannot merge even when the runtime guard never fired.

### Data Requirements
- **Input**: `docs/PRD.md`/`docs/use-cases/*`/`docs/qa/*`'s actual on-disk content at merge-ready time
- **Output**: Gate 1 PASS/FAIL
- **Side Effects**: None

---

## UC-8: `pre:edit:read-guard` — Edit/Write Requires a Prior Read This Session

**Actor**: Claude Code; Developer
**Preconditions**: `pre:edit:read-guard` registered under both events (`PostToolUse`/`Read` recorder, `PreToolUse`/`Edit|Write` gate), not suppressed; mechanizes `src/rules/scratchpad.md`'s "Re-Read Before Edit (MANDATORY)" rule
**Trigger**: An `Edit` or `Write` call against a file that already exists on disk

### Primary Flow (Block — Editing Without Reading This Session)
1. Session starts; the model has not issued any `Read` tool call against `src/handlers/foo.js` in this session (it may recall the file's content from an earlier, now-compacted turn, or simply assume it).
2. The model issues `Edit` against `src/handlers/foo.js`, an existing file.
3. `pre:edit:read-guard`'s `PreToolUse` gate half checks the session's read record (a file under `.claude/tmp/`, session-keyed, same sanitization/symlink-defense pattern as Section 7's accumulator — FR-4.1/FR-4.2) and finds `src/handlers/foo.js`'s resolved absolute path absent.
4. Deny: reason names the target file and instructs `Read` it before retrying (FR-4.8, AC-8).
5. **Mechanically checkable outcome**: deny reason contains the file's path and the literal instruction to `Read` it; the `Edit` is not applied.

**Postconditions**: The file on disk is unchanged; the model's remedy (issue a `Read`, then retry the `Edit`) is Rule 1/2-classifiable — free, self-resolving.

### Alternative Flows (Allow)
- **UC-8-A1: An `Edit` to a file that WAS read this session (AC-8)** — the model issues `Read` against `src/handlers/foo.js` earlier in the same response or session; `PostToolUse`'s recorder half appends its resolved absolute path to the read record. The model then issues `Edit` against the same file; the gate half finds the path present and does not deny — exit `0`, no `permissionDecision`, the `Edit` applies. **This MUST NOT be re-denied regardless of how much of the file's content changed since the `Read`** (FR-4.5) — a `Read` followed by any number of `Edit`s in the same session all pass, not merely the first.
- **UC-8-A2: The creation of a brand-new file (nothing to have read) (AC-8)** — a `Write` targeting `src/handlers/bar.js`, which does not exist on disk. FR-4.4 states this MUST NOT be denied "under any circumstance" — the guard checks file-existence before checking the read record at all; there is nothing to have read, so the gate is inapplicable by construction, not merely satisfied. This is the guard's second everyday allow path (alongside UC-8-A1) and both together represent the dominant traffic through this guard during ordinary implementation work — new files are created constantly, and every re-edit of an already-read file passes freely.
- **UC-8-A3: `SDLC_ALLOW_UNREAD_EDIT=1` set for the call (FR-4.6)** — an `Edit` to an existing, unread-this-session file proceeds despite step 3's finding — the named legitimate case: the model wrote the file itself earlier in the same response, before any `Read` was needed, and has independent, verified knowledge of its current content.

### Error Flows
- **UC-8-E1: Fail-open** — the read-tracker's own file I/O throws (e.g. `.claude/tmp/` is unwritable) — per FR-1.2/FR-1.3, exit `0`, no deny, `systemMessage` reason `exception`; both halves (recorder and gate) independently fail open using the same wrapper Section 7 established.

### Edge Cases
- **UC-8-EC1**: A `Read` that itself fails (e.g. targets a nonexistent path, or errors) — FR-4.1 records only a *successful* `Read` tool call's resolved path; a failed `Read` populates nothing. A subsequent `Write` to that same (still nonexistent) path is unaffected by this guard regardless, since FR-4.4's brand-new-file exemption applies independent of read history.
- **UC-8-EC2 (path-resolution consistency)**: The model `Read`s a file via a relative path (`./src/handlers/foo.js`) and later `Edit`s it via an equivalent but textually different path (an absolute path, or a path traversing a symlink to the same underlying file). The recorder and gate halves MUST resolve both to the same canonical absolute path (mirroring Section 7's `pathIsSafe` symlink-defense precedent) before comparing — a naive string-equality comparison would false-positive-deny a legitimate re-edit whose only difference from the `Read` call is textual path form, not target identity. This is flagged as a required fixture, not an assumed-correct implementation detail.
- **UC-8-EC3**: The same file is `Read` once, then `Edit`ed twice in the same session — both `Edit`s pass (UC-8-A1's "regardless of how many" clause); the read record is not consumed or cleared by a matching `Edit`, only garbage-collected on the same capped, best-effort schedule as Section 7's accumulator (FR-4.7).
- **UC-8-EC4**: `SDLC_DISABLED_HOOKS` contains `pre:edit:read-guard` — **both** event registrations no-op (the recorder half never appends, the gate half never checks), since `run-hook.js` gates by id before dispatch regardless of which event triggered the invocation (FR-4.6's explicit "both event registrations" clause) — a partial disable (recorder off, gate still active, or vice versa) MUST NOT occur.

### Data Requirements
- **Input**: `PostToolUse` stdin's `tool_input`/`tool_response` for `Read` (recorder half); `PreToolUse` stdin's `tool_input` target path plus the session's read record (gate half)
- **Output**: `deny` naming the target file and the `Read`-first remedy, or silent proceed; a `Write` creating a new file is never inspected against the record at all
- **Side Effects**: The read record file under `.claude/tmp/` is appended to (successful `Read`s) and periodically garbage-collected — the developer's own file content on disk is never touched by this guard

---

## UC-8-B: `pre:edit:read-guard` → Gate 4 Backstop

**Actor**: Developer; `merge-ready`'s Gate 4 (Build Verification)
**Preconditions**: `pre:edit:read-guard` disabled or mechanism-failed for an `Edit` made against stale, unread context
**Trigger**: `/merge-ready` runs Gate 4 (typecheck, test, build)

### Primary Flow
1. With the guard suppressed, an `Edit` was applied against a file the model had not actually read this session, based on a stale or hallucinated assumption about its content.
2. The edit's `old_string` either did not cleanly correspond to the file's real content, or introduced a change inconsistent with code elsewhere in the file that the model never saw.
3. Gate 4 (FR-4.9) runs typecheck/test/build and surfaces the resulting failure — most commonly a type error, a failing test, or a build break — before merge, independent of whether `pre:edit:read-guard` caught the missing `Read` at edit time.

**Postconditions**: A defect introduced by an unread-context edit is caught before merge even when the runtime guard degraded.

### Data Requirements
- **Input**: The project's typecheck/test/build command output at merge-ready time
- **Output**: Gate 4 PASS/FAIL
- **Side Effects**: None beyond the build tools' own normal execution

---

## UC-9: `pre:edit:config-protection` — Config File Weakening Detection

**Actor**: Claude Code; Developer
**Preconditions**: `pre:edit:config-protection` registered, not suppressed; target matches one of `tsconfig*.json`, `jsconfig.json`, `.eslintrc*`, `eslint.config.*`, `biome.json(c)`, `.prettierrc*`, `prettier.config.*`, `jest.config.*`, `vitest.config.*` (FR-5.1)
**Trigger**: An `Edit`/`Write` against a matched config file whose pre/post content differs in a weakening way

### Primary Flow (Block — Flipping `strict` to `false`)
1. `tsconfig.json` currently contains `"strict": true`.
2. The model issues an `Edit` with `old_string` containing `"strict": true` and `new_string` containing `"strict": false`.
3. The guard computes pre-edit and post-edit content (applying the replacement, or using the `Write` content directly) and finds a boolean strictness key (`strict`) flipped `true → false` (FR-5.2(a)).
4. Deny: reason names the flipped key and its old/new value, and states the remedy — set `SDLC_ALLOW_CONFIG_EDIT=1` if this slice legitimately changes configuration (AC-9, FR-5.6).
5. **Mechanically checkable outcome**: deny reason contains `strict`, `true`, `false`, and the literal string `SDLC_ALLOW_CONFIG_EDIT`.

**Postconditions**: `tsconfig.json` on disk is unchanged; strictness is not silently weakened.

### Alternative Flows (Allow)
- **UC-9-A1: An `Edit` to a matched config file that does not trigger any FR-5.2 condition (FR-5.5)** — e.g. adding a new, non-weakening compiler option, or a pure whitespace/formatting reflow that changes no strictness key, ESLint severity, or `extends`/`plugins` entry — not denied. This, together with UC-9-A2/A3 below, is the guard's dominant everyday path: most edits to a `tsconfig.json` or `.eslintrc*` in a normal slice add configuration, they do not remove it.
- **UC-9-A2: A project declaring none of the FR-5.1 config files at all** — the guard's file-path matcher never fires for any `Edit`/`Write` in that project; combined with UC-10-A's non-`@ts-nocheck` case, this is FR-5.4's explicit silent no-op guarantee, mirroring Section 7's `stop:typecheck-format` "no command configured" precedent (`hook-infrastructure_use_cases.md` UC-8).
- **UC-9-A3: `SDLC_ALLOW_CONFIG_EDIT=1` set for the call (AC-9)** — the identical `strict: true → false` `Edit` from the primary flow proceeds. This is the legitimate, explicitly-named case a slice whose actual, in-scope work is relaxing a lint or type-check rule (Risk 2 in the PRD's own risk list) must exercise, and it is expected to be used deliberately, not as a routine bypass.

### Error Flows
- **UC-9-E1: Fail-open** — the pre/post content diff computation throws (e.g. the config file's current content cannot be read, or a `JSON.parse` fails on genuinely malformed pre-edit JSON that the guard's own detection logic does not defensively guard) — exit `0`, no deny, `systemMessage` reason `exception`; the edit proceeds unchecked for this one call.

### Edge Cases
- **UC-9-EC1**: An ESLint rule's severity is removed from an explicit `rules` block entirely, rather than downgraded in place — FR-5.2(b)'s explicit "or a rule key present pre-edit is removed entirely from an explicit `rules` block" clause covers this as equivalent to a `"error"`→`"off"` downgrade, not a separate, unlisted case.
- **UC-9-EC2**: An entry is removed from `extends` (e.g. dropping `"eslint:recommended"`) or `plugins` — denied per FR-5.2(c), independent of whether any individual rule's severity changed; removing an `extends` entry can silently disable dozens of rules at once, which is exactly the shape this clause targets.
- **UC-9-EC3**: A rule's severity is *raised* (`"warn"` → `"error"`, or `0`/`1` → `2`) — this is a strengthening change, the inverse of FR-5.2(b)'s denied direction; not denied, since FR-5.2 only lists the weakening direction as a deny condition.
- **UC-9-EC4**: Detection is regex/structural (JSON key inspection, line-based scanning), not a full AST parse, per FR-5.7's explicit zero-dependency constraint — a config file using an unusual-but-valid JSON formatting style (e.g. keys reordered, or `strict` nested inside a differently-cased sibling object the regex does not anticipate) could in principle evade or false-positive the structural check; this is a known limitation of the chosen detection strategy, not a defect this document resolves, and mirrors the same class of limitation already documented for `permissions.deny` pattern matching (`hook-infrastructure_use_cases.md` UC-9-EC2).

### Data Requirements
- **Input**: The config file's pre-edit and post-edit content (computed by applying the `Edit`'s replacement, or reading the `Write`'s content directly)
- **Output**: `deny` naming the specific weakened key/rule/array-entry and the `SDLC_ALLOW_CONFIG_EDIT` remedy, or silent proceed
- **Side Effects**: None from the guard; a denied `Edit`/`Write` never touches disk

---

## UC-10: `pre:edit:config-protection` — `@ts-nocheck` and Blanket `eslint-disable` in Any Source File

**Actor**: Claude Code; Developer
**Preconditions**: Same guard as UC-9, but this check applies independent of FR-5.1's config-file path match — it inspects **any** source file's `Edit`/`Write` (FR-5.3)
**Trigger**: An `Edit`/`Write` whose post-edit content introduces a `@ts-nocheck` directive, or a bare `eslint-disable` with no rule names listed, not already present pre-edit

### Primary Flow (Block — Introducing `@ts-nocheck`)
1. `src/handlers/foo.js` currently has no `@ts-nocheck` directive.
2. The model issues a `Write` whose content adds `// @ts-nocheck` at the top of the file (e.g. to silence a type error the model could not otherwise resolve).
3. The guard finds `@ts-nocheck` present post-edit and absent pre-edit — deny.
4. Reason names the directive and the remedy: fix the underlying type error, or set `SDLC_ALLOW_CONFIG_EDIT=1` if this suppression is deliberate and reviewed (AC-9's second clause).
5. **Mechanically checkable outcome**: deny reason contains `@ts-nocheck`; the file on disk is unchanged.

**Postconditions**: No new blanket type-check or lint suppression lands silently.

### Alternative Flows (Allow)
- **UC-10-A1: A *scoped*, rule-specific `eslint-disable-next-line` with the rule named, e.g. `// eslint-disable-next-line no-unused-vars` (as distinct from a bare `eslint-disable`)** — FR-5.3 explicitly names this as the non-denied shape ("as distinct from a rule-scoped `eslint-disable-next-line no-unused-vars`"); the guard's directive scan matches only the *bare*, unscoped form — a scoped, named-rule disable comment introduced fresh is not denied by this check, since it disables one rule on one line rather than every rule for the rest of the file (or the whole file, for a top-of-file blanket directive). This is the everyday, legitimate pattern for a deliberate, narrow suppression (e.g. a generated file, or a genuinely unavoidable false positive) and MUST NOT be denied.
- **UC-10-A2: `@ts-nocheck` or a bare `eslint-disable` was already present in the file's pre-edit content** — an `Edit` that touches an unrelated part of a file that already carried the directive before this session started does not introduce it; FR-5.3's condition is "not already present in the file's pre-edit content" — an edit that leaves a pre-existing directive untouched is not denied (the guard only fires on directives newly introduced by this specific call).
- **UC-10-A3: `SDLC_ALLOW_CONFIG_EDIT=1` set for the call** — the identical new `@ts-nocheck` (or bare `eslint-disable`) from the primary flow proceeds.
- **UC-10-A4: A project with no matched config files (FR-5.1) AND no new `@ts-nocheck`/bare-`eslint-disable` introduced (FR-5.3)** — a normal, non-suppressing `Edit`/`Write` to any source file in such a project results in the guard's total silence (FR-5.4) — no config-path match, no directive match, nothing to inspect.

### Error Flows
- **UC-10-E1: Fail-open** — identical shape to UC-9-E1; a directive-scan exception exits `0`, no deny.

### Edge Cases
- **UC-10-EC1**: `/* eslint-disable */` (block-comment form, no rule names) vs `// eslint-disable` (line-comment form, no rule names) — FR-5.3 names both explicitly as the denied bare shape; the scan MUST cover both comment syntaxes, not only one.
- **UC-10-EC2**: A bare `eslint-disable` that DOES list rule names on the same or a continuation line in an unusual format the line-based scanner does not anticipate — a known limitation of the regex/line-based detection strategy (FR-5.7), consistent with UC-9-EC4's caveat; not resolved by this document.
- **UC-10-EC3**: This check and FR-5.2's config-file weakening check (UC-9) can both fire on the same response if a slice both weakens `tsconfig.json` AND introduces `@ts-nocheck` in a different source file — both are independent findings; each produces its own deny on its own respective tool call, not a combined single check.

### Data Requirements
- **Input**: The target file's pre-edit and post-edit content, scanned for the two directive shapes
- **Output**: `deny` naming the introduced directive and the `SDLC_ALLOW_CONFIG_EDIT` remedy, or silent proceed
- **Side Effects**: None

---

## UC-9/10-B: `pre:edit:config-protection` → Gate 2 Backstop

**Actor**: Developer; `merge-ready`'s Gate 2 (Code Review)
**Preconditions**: `pre:edit:config-protection` disabled or mechanism-failed for a config-weakening or `@ts-nocheck`-introducing edit
**Trigger**: `/merge-ready` runs Gate 2, delegated to `code-reviewer`

### Primary Flow
1. With the guard suppressed, a slice's `Edit` silently downgraded an ESLint rule from `"error"` to `"off"`, or introduced an undetected `@ts-nocheck`.
2. Gate 2 (FR-5.8) reviews the slice's changed files for "proper types, no dead code, error handling present" — a `code-reviewer` pass over a file carrying an undetected suppression is expected to flag the suppression itself as a code-quality defect, independent of whether the runtime guard caught it at edit time.
3. Gate 2 fails (or flags for follow-up), blocking `MERGE READY` until resolved.

**Postconditions**: A quietly weakened config or suppressed type-check does not merge silently even if the runtime guard degraded.

### Data Requirements
- **Input**: The slice's changed files, reviewed by `code-reviewer` against the plan's declared scope
- **Output**: Gate 2 PASS/FAIL
- **Side Effects**: None

---

## UC-11: `pre:agent:isolation-guard` — Subagent Isolation for Scratchpad/Changelog Writes

**Actor**: Claude Code; Developer (orchestrator context); parallel-wave subagent (distinct actor class)
**Preconditions**: `pre:agent:isolation-guard` registered, not suppressed; the FR-6.1 spike has been run once (as a one-time implementation-record finding, not a per-session check) and its result — "reliable indicator found, field `X`" or "no reliable indicator found" — determines which of the two mutually exclusive branches below is live in the shipped handler
**Trigger**: An `Edit`/`Write` targeting `.claude/scratchpad.md` or `CHANGELOG.md`

### Primary Flow A — FR-6.2 Branch (Spike Found a Reliable Indicator): Block a Subagent Write
1. The FR-6.1 spike's finding, recorded in the implementation record, names a specific stdin field (e.g. a subagent-type identifier or a distinguishing `session_id`/transcript-path shape) that reliably distinguishes subagent-originated calls.
2. During a parallel-wave slice, a subagent's own tool-call context issues a `Write` to `.claude/scratchpad.md`.
3. The guard inspects `PreToolUse` stdin, finds the confirmed subagent indicator present.
4. Deny: reason states that only the orchestrator writes the scratchpad/changelog, and the remedy — the subagent should return its findings in its own response for the orchestrator to record instead.
5. **Mechanically checkable outcome**: deny (exit `2` or `permissionDecision: "deny"`) with a reason naming the target file and "orchestrator"; `.claude/scratchpad.md` on disk is unchanged.

**Postconditions**: `.claude/scratchpad.md`/`CHANGELOG.md` are written only by the orchestrator's own context, mechanizing `src/rules/scratchpad.md`'s orchestrator-only rule and Section 2 FR-2.6.

### Alternative Flows (Allow — FR-6.2 Branch)
- **UC-11-A1: The orchestrator (not a subagent) writing the scratchpad** — the identical `Write` to `.claude/scratchpad.md`, issued from the orchestrator's own top-level tool-call context (no subagent indicator present in stdin), is NOT denied (FR-6.2's explicit "a call from the orchestrator's own context ... MUST NOT be denied"). This is the guard's everyday, expected path: the orchestrator updates the scratchpad after every commit per `src/rules/scratchpad.md`'s "MUST Write" rule, and this MUST never be blocked.
- **UC-11-A2: `SDLC_ALLOW_SUBAGENT_WRITE=1` set for the call (FR-6.5)** — the subagent's write from the primary flow proceeds despite the confirmed subagent indicator — the guard's own scoped escape, applicable only in the FR-6.2 branch.
- **UC-11-A3: A subagent's `Edit`/`Write` to any file OTHER than `.claude/scratchpad.md`/`CHANGELOG.md`** — outside FR-6.2's own file-path match; not inspected by this guard at all (a subagent legitimately edits source files as part of its assigned slice work — that is its entire purpose).

### Primary Flow B — FR-6.3 Branch (Spike Found No Reliable Indicator): Fail Visibly, Never Silently
1. The FR-6.1 spike's finding, recorded in the implementation record, states that no stdin field reliably and consistently distinguishes subagent-originated calls from orchestrator-originated ones.
2. Any `Edit`/`Write` to `.claude/scratchpad.md` or `CHANGELOG.md` occurs — from either a subagent's context or the orchestrator's own context; the guard cannot tell which.
3. The guard emits an unconditional, visible `systemMessage` stating plainly that subagent-origin cannot be determined from available stdin fields and this guard therefore cannot enforce the isolation rule mechanically (FR-6.3).
4. The guard does NOT deny the call — exit `0`, no `permissionDecision` field, the write proceeds.
5. **Mechanically checkable outcome (AC-10's dual-fixture requirement)**: the identical warning `systemMessage` text fires on both a simulated subagent call AND a simulated orchestrator call — a fixture asserting this MUST run both simulated origins and confirm the warning text is byte-identical in trigger condition (fires unconditionally, every time, on every matching write) regardless of origin.

**Postconditions (FR-6.3 branch)**: This guard's PRD requirement is satisfied by the visible-warning behavior itself, not by any blocking capability (FR-6.6) — a scratchpad/changelog write from a genuinely rogue subagent is never denied in this branch, but the gap is surfaced loudly on every occurrence rather than looking installed while silently never firing (roadmap F2b's own stated failure mode).

### Error Flows
- **UC-11-E1: Fail-open (either branch)** — the guard's own stdin-field inspection throws — exit `0`, no deny, `systemMessage` reason `exception`; in the FR-6.2 branch this means the write proceeds unchecked for that one call (no different in kind from any other guard's mechanism-failure path); in the FR-6.3 branch, a thrown exception during the warning-construction step similarly still exits `0`, though it degrades only the specific warning text delivered, not proceed-vs-block (since FR-6.3's branch never blocks regardless).

### Edge Cases
- **UC-11-EC1 (the subagent-indicator spike itself, as a distinct scenario from either shipped branch)**: Before FR-6.1's spike is run, or on a machine where the spike's finding has not yet been recorded, neither branch's logic exists to test — this is a build-time/implementation-record precondition, not a runtime scenario; FR-6.1 makes resolving which branch applies "the first unit of work," not an optional investigation, precisely so this guard never ships in an undefined state between the two branches.
- **UC-11-EC2**: Both branches are mutually exclusive by construction — a shipped handler implements exactly one (FR-6.2 XOR FR-6.3), never both conditionally per-call; this document does not assert which branch this repository's own implementation lands on, mirroring `hook-infrastructure_use_cases.md` UC-4-A3's precedent of not asserting an answer the PRD leaves to implementation-time investigation.
- **UC-11-EC3**: `SDLC_DISABLED_HOOKS` contains `pre:agent:isolation-guard` — in the FR-6.2 branch, this disables the deny logic entirely (a subagent's scratchpad write proceeds unchecked); in the FR-6.3 branch, this also silences the visible warning itself, since the entire handler is what's disabled, not merely its blocking capability (which, in that branch, doesn't exist to disable in the first place).

### Data Requirements
- **Input**: `PreToolUse` stdin, specifically whichever field the FR-6.1 spike identified (or the full envelope, in the FR-6.3 branch, which cannot identify one); the target file path
- **Output (FR-6.2 branch)**: `deny` naming the target file and the orchestrator-only remedy, or silent proceed for an orchestrator-context call
- **Output (FR-6.3 branch)**: An unconditional `systemMessage` warning on every matching write, never a `deny`
- **Side Effects**: None from the guard itself in either branch — no state file is written; this guard only reads stdin and the target path

---

## UC-11-B: `pre:agent:isolation-guard` → Backstop Chain (Changelog Idempotency Guard, Then Gate 0)

**Actor**: Developer; `stop:changelog-guard`'s idempotency assertion (Section 5 FR-1.6); `merge-ready`'s Gate 0
**Preconditions**: `pre:agent:isolation-guard` disabled, mechanism-failed, or (in the FR-6.3 branch) structurally unable to block a subagent's colliding write
**Trigger**: A parallel-wave subagent writes to `CHANGELOG.md` or `.claude/scratchpad.md` undetected

### Primary Flow
1. With isolation enforcement absent (any of the three preconditions), a subagent writes an entry to `CHANGELOG.md`.
2. The changelog's own idempotency guard (Section 5 FR-1.6, mechanically checked by `stop:changelog-guard`'s FR-7.2(e) duplicate-name assertion) collapses a colliding same-name entry into an in-place update rather than a duplicate — the first backstop (FR-6.7).
3. Independent of the changelog-specific backstop, `merge-ready`'s **Gate 0 (Git Hygiene)** — "working tree clean" — surfaces any unaccounted-for mutation to `.claude/scratchpad.md` or `CHANGELOG.md` attributable to a subagent as an unexpected working-tree change before merge — the second backstop.

**Postconditions**: A subagent's isolation-rule violation cannot silently corrupt shared state past two independent downstream checks, even with the runtime guard fully absent.

### Data Requirements
- **Input**: `CHANGELOG.md`'s entry-name uniqueness (idempotency backstop); the repository's working-tree diff at merge-ready time (Gate 0 backstop)
- **Output**: An in-place update instead of a duplicate entry (idempotency backstop); Gate 0 PASS/FAIL (Gate 0 backstop)
- **Side Effects**: None beyond the idempotency guard's own in-place update mechanism (unrelated to this guard)

---

## UC-12: `stop:changelog-guard` — Changelog Shape and Idempotency Assertion, Bounded Blocking

**Actor**: Claude Code; Developer
**Preconditions**: `stop:changelog-guard` registered, not suppressed; asserts shape and idempotency only — **never** timestamp freshness (FR-7.3)
**Trigger**: The `Stop` event fires and `git status --porcelain -- CHANGELOG.md`, run in the resolved project root, shows `CHANGELOG.md` changed during the current response

### Primary Flow (Block — Missing `**Details:**` Line)
1. The response wrote a new `### Add CSV export — 14:30 UTC` entry under today's day heading, followed by a `**Summary:**` line, but with no `**Details:**` line at all.
2. `Stop` fires; `git status --porcelain -- CHANGELOG.md` shows the file modified — the guard proceeds to inspect content (FR-7.1).
3. FR-7.2's shape assertions run: (a) today's day heading exists — pass; (b) the first entry matches `### <name> — HH:MM UTC` — pass; (c) a `**Summary:**` line immediately follows — pass; (d) a `**Details:**` line follows and is ≤500 chars — **fail**, no `**Details:**` line present at all.
4. The guard returns a blocking `Stop` decision: `decision: "block"` (or exit `2`), `reason` identifying the specific defect — "missing `**Details:**` line" (AC-11).
5. Claude Code forces another turn instead of ending the response; the model is expected to add the missing line and end its response again.
6. **Mechanically checkable outcome**: `decision: "block"` (or exit `2`) with `reason` naming `**Details:**`.

**Postconditions**: The response does not end with a shape-defective changelog entry uncorrected; the session-keyed block counter (under `.claude/tmp/`, same location/sanitization as the FR-4 read record) increments to `1`.

### Alternative Flows (Allow)
- **UC-12-A1: An entry meeting all shape requirements does not block `Stop` (AC-11)** — day heading present, entry heading format correct, `**Summary:**` present, `**Details:**` present and ≤500 chars, no duplicate name under today's heading — all FR-7.2 assertions pass; the guard no-ops with respect to blocking; `Stop` proceeds; the block counter resets to `0` (FR-7.5's explicit reset-on-pass clause).
- **UC-12-A2: `CHANGELOG.md` was not modified this response (FR-7.1)** — `git status --porcelain -- CHANGELOG.md` shows no change; the guard no-ops entirely without inspecting content at all — this is the ordinary case for the overwhelming majority of responses (most turns during a slice don't touch the changelog, since only `/merge-ready`'s finalization step or a standalone `/implement-slice` writes it, per `src/rules/changelog.md`'s Trigger Ownership).
- **UC-12-A3: A changelog entry written 40 minutes into a long response — MUST pass, since the guard cannot assert freshness (FR-7.3)** — the entry's stated `### ... — HH:MM UTC` reflects the time it was actually written (per `date -u`, honestly recorded), but the `Stop` event fires 40 minutes of elapsed wall-clock time later. The guard MUST NOT compare the stated time against its own current clock and MUST NOT flag staleness — this is an explicit prohibition (FR-7.3), not merely an unimplemented feature: "a hook can only compare against 'now,' and a legitimate entry written 40 minutes into a long response would incorrectly fail such a check." All shape/idempotency assertions still apply normally; only freshness is categorically excluded. **Mechanically checkable outcome**: a fixture asserting a 40-minute (or any) synthetic elapsed-time gap between the entry's `HH:MM UTC` and the guard's simulated invocation time produces the same PASS/FAIL result as a zero-elapsed-time fixture with identical shape content — the elapsed time must have zero effect on the outcome.
- **UC-12-A4: `SDLC_ALLOW_CHANGELOG_SHAPE=1` set for the session (FR-7.7)** — the primary flow's missing-`**Details:**` entry does not block `Stop` (the guard MAY still emit a non-blocking `systemMessage` noting the defect); `Stop` proceeds regardless.

### Error Flows
- **UC-12-E1: Duplicate entry name under the same day heading** — two separate `### Add CSV export — ...` entries (case-insensitive, trimmed match) exist under today's heading — FR-7.2(e) denies with a reason naming the duplicated entry name and instructing an in-place update instead of a second entry, per the idempotency guard's own prescribed remedy.
- **UC-12-E2: Details exceeds 500 characters** — FR-7.2(d) denies, reason states the character count and the 500-character cap.
- **UC-12-E3 (bounded blocking, AC-11's 3-consecutive-failure fixture)**: The session has already accumulated 2 consecutive blocking decisions without an intervening pass (from two prior `Stop` events in the same session, each with a still-defective entry). A third consecutive defect occurs. FR-7.5 requires the guard to stop blocking after 2 consecutive blocks: on this 3rd consecutive failure, the guard instead emits a **non-blocking** `systemMessage` warning and allows `Stop` to proceed — deferring final correctness to the merge-ready backstop (FR-7.6) rather than forcing an unbounded number of turns. **Mechanically checkable outcome**: block, block, then warn-and-proceed — a fixture MUST assert the counter file's value at each of the 3 steps and confirm the 3rd `Stop` event's exit/decision differs in kind from the first two.
- **UC-12-E4: Fail-open** — the guard's own `git status`/content-parsing logic throws — exit `0`, no `decision: "block"`, `systemMessage` reason `exception`; `Stop` proceeds with the changelog defect uncorrected for that response (see UC-14) — the merge-ready backstop is the safety net here, not a repeated in-session retry.

### Edge Cases
- **UC-12-EC1**: `CHANGELOG.md` is entirely absent (not yet created) but the response's diff shows it newly added — `git status --porcelain` reports this as an addition; the guard still inspects its content per FR-7.1's "modification, addition, or staged change" trigger condition, applying the same FR-7.2 assertions to a first-ever entry.
- **UC-12-EC2**: The block counter resets to `0` on any passing check (FR-7.5) — a session that blocks once, then passes, then fails again starts a fresh count of `1`, not `2` — consecutive is literal, not cumulative across the whole session.
- **UC-12-EC3**: Design Decision 4's race-avoidance — `stop:changelog-guard` determines "changed this response" via `git status --porcelain -- CHANGELOG.md`, never via `post:edit:accumulate`'s accumulator file, specifically because `stop:typecheck-format` (registered as the other `Stop`-event hook) reads and then clears that same accumulator; had `stop:changelog-guard` also relied on it, the order the two `Stop` hooks fire in would determine which one still sees the accumulated paths — `git status` sidesteps this ordering dependency entirely and is exactly as cheap.

### Data Requirements
- **Input**: `git status --porcelain -- CHANGELOG.md` output; `CHANGELOG.md`'s current content; the session's block-counter state file under `.claude/tmp/`; `SDLC_ALLOW_CHANGELOG_SHAPE` from the environment
- **Output**: `decision: "block"` (or exit `2`) naming the specific shape/idempotency defect and a remedy, or silent/warning proceed
- **Side Effects**: The block-counter state file is incremented on each consecutive block and reset to `0` on each pass — no mutation of `CHANGELOG.md` itself by this guard (it only reads and asserts)

---

## UC-12-B: `stop:changelog-guard` → Merge-Ready Finalization Backstop

**Actor**: Developer; `merge-ready`'s changelog finalization step (Section 5 FR-2), `doc-updater`
**Preconditions**: `stop:changelog-guard` disabled, mechanism-failed, or bound-exhausted (UC-12-E3) for a defective entry
**Trigger**: `/merge-ready` runs its finalization step

### Primary Flow
1. With the guard degraded (any of the three preconditions), a shape-defective or duplicated changelog entry reached the end of a response uncorrected.
2. `/merge-ready`'s changelog finalization step (FR-7.6) re-invokes the `doc-updater` agent against `src/rules/changelog.md`'s format rules and the same idempotency guard, independent of the in-session hook's own runtime behavior.
3. `doc-updater` corrects the shape defect (or collapses a duplicate into an in-place update) before the feature is declared `MERGE READY`.

**Postconditions**: A defect that slipped past a degraded or bound-exhausted `stop:changelog-guard` is still caught before merge, not merely before the response ended.

### Data Requirements
- **Input**: `CHANGELOG.md`'s actual content at merge-ready time
- **Output**: A corrected, format-compliant `CHANGELOG.md`
- **Side Effects**: `doc-updater` may rewrite the defective entry in place

---

## UC-13: `pre:edit:gateguard` — Opt-In Fact-Forcing First-Edit Gate

**Actor**: Claude Code; Developer
**Preconditions**: `pre:edit:gateguard` registered; `SDLC_GATEGUARD` is set to exactly the literal string `on` (any other value, or unset, is covered separately below); `.claude/scratchpad.md`'s currently active slice is extracted via the same structured-field extraction `session:start:spine` uses (FR-8.2)
**Trigger**: An `Edit`/`Write` call against a target file, within the currently active slice

### Primary Flow (Block Once, Then Allow — First Edit to a File This Slice)
1. `SDLC_GATEGUARD=on`; the scratchpad names "Slice 5" as the currently in-progress slice.
2. The model issues the first `Edit`/`Write` this slice makes against `src/handlers/foo.js`.
3. The guard checks its state record (keyed by the tuple: sanitized `session_id`, slice identifier, target file path — FR-8.2) under `.claude/tmp/` and finds no entry for `(session, Slice 5, src/handlers/foo.js)`.
4. Deny: the reason requires the model to state, before retrying: (a) which files import or reference `src/handlers/foo.js` — a concrete list, or an explicit "none found" after a search; (b) what public surface (exports, routes, props, schema) the edit changes; (c) a verbatim quote of the current planner instruction (the slice's `Changes:` field) driving this edit (FR-8.3, AC-12).
5. **Mechanically checkable outcome**: deny reason contains all three fact-forcing element labels/prompts; no state entry is written yet (the deny itself does not record the pair — see step 6).
6. The model performs the requested investigation (searches for importers, states the public-surface impact, quotes the planner's `Changes:` field) and reissues the identical `Edit`/`Write` against `src/handlers/foo.js`.
7. The guard now records `(session, Slice 5, src/handlers/foo.js)` as fact-forced and does not deny — exit `0`, the `Edit`/`Write` applies. **The guard does not grade the content of the model's restated answer** (FR-8.4) — it forces the investigation, not a correct investigation.

**Postconditions**: The `(session, slice, file)` tuple is now recorded; every subsequent call against the same tuple within the same slice is allowed without re-prompting.

### Alternative Flows (Allow)
- **UC-13-A1: A second, later `Edit` to the SAME file within the SAME slice (AC-12)** — after step 7, a wholly separate, later `Edit` call against `src/handlers/foo.js` still within "Slice 5" — the tuple is already recorded; not denied. This holds whether the second call is literally the retry from step 6 or an unrelated further edit to the same file later in the same slice — FR-8.4's "MUST NOT re-deny... a second time regardless" does not distinguish the two.
- **UC-13-A2: `SDLC_GATEGUARD` unset, or set to any value other than the literal string `on` (FR-8.5, AC-12)** — e.g. unset, `SDLC_GATEGUARD=true`, `SDLC_GATEGUARD=1`, `SDLC_GATEGUARD=ON` (wrong case) — the handler behaves as if absent for every call: no `systemMessage`, no state file write, no denial, for any `Edit`/`Write` in the slice. This is the guard's default, everyday state across the vast majority of projects (opt-in, FR-8.5) and MUST produce zero observable output for this hook id across a full fixture run (AC-12's explicit "zero output" assertion).
- **UC-13-A3: A first `Edit` to a DIFFERENT file within the same slice** — `(session, Slice 5, src/handlers/bar.js)` has its own, independent tuple; this is gated for the first time exactly as `foo.js` was in the primary flow — being fact-forced on one file in a slice does not exempt a different file in the same slice.

### Error Flows
- **UC-13-E1: Fail-open** — the guard's own scratchpad-slice extraction or state-file read/write throws — exit `0`, no deny, `systemMessage` reason `exception`; the `Edit` proceeds unchecked for that one call, and the tuple is not recorded (so a subsequent call against the same file may be gated fresh once the mechanism recovers, which is an acceptable, non-blocking outcome under fail-open).

### Edge Cases
- **UC-13-EC1**: The slice advances (e.g. from "Slice 5" to "Slice 6") and `src/handlers/foo.js` is edited again — the tuple's slice component changed, so `(session, Slice 6, src/handlers/foo.js)` is a new, unrecorded key; the guard gates this as a first-time edit again, independent of `foo.js` having already been fact-forced under Slice 5. This follows directly from FR-8.2's tuple design and is not a separate escape hatch — it is the guard doing exactly what its key definition specifies.
- **UC-13-EC2**: `SDLC_DISABLED_HOOKS` contains `pre:edit:gateguard` while `SDLC_GATEGUARD=on` is also set — the kill switch takes precedence (Section 7 FR-4.3 precedent for id-based disabling applies uniformly); FR-8.8 names this explicitly as "a redundant kill switch alongside the opt-in default" for a project that wants to stop GateGuard's friction without unsetting `SDLC_GATEGUARD` project-wide.
- **UC-13-EC3 (promotion criteria, a longitudinal measurement, not a per-session runtime check)**: FR-8.6 requires 10 consecutive slices run with `SDLC_GATEGUARD=on`, a comparison of `merge-ready`'s first-pass gate-failure rate against the same project's prior 10-slice baseline, and no single slice blocked more than 2 model turns before proceeding, reviewed at the roadmap's F5 kickoff — this criterion is not mechanically checkable within any single session covered by this document's other UCs; it is recorded here as a data-collection obligation (the implementation record MUST track it across the 10-slice window) rather than a fixture-testable flow. If unmeasured by F5 kickoff, GateGuard MUST be removed from the codebase entirely (FR-8.6(d)) rather than left permanently opt-in-and-unmeasured.

### Data Requirements
- **Input**: `SDLC_GATEGUARD` from the environment; `.claude/scratchpad.md`'s currently active slice identifier; the target file path; the guard's own state record under `.claude/tmp/`
- **Output**: `deny` containing all three fact-forcing prompts (once per file per slice), or silent proceed thereafter, or total silence when the literal opt-in token is absent
- **Side Effects**: The gateguard-state record file is appended to on each first-time-per-slice denial; no other file is touched

---

## UC-14: Fail-Open Under Blocking Semantics — A Guard Whose Own Logic Throws Must Allow, Never Deny

This is the single most important cluster in this document, and the reason it is written out separately rather than folded into each guard's own "Error Flows" (where it also appears, briefly, per guard, for local completeness). **`hook-infrastructure_use_cases.md` UC-3's six failure shapes (handler throws, handler times out, Node missing, Node too old, dispatch-table module missing, malformed stdout) apply to all 7 of this document's guards unmodified (FR-1.2)** — this UC does not re-derive them; it isolates the one property specific to *blocking* hooks that Section 7's non-blocking hooks never had to get right: **for a deny-capable guard, "fail-open" means "allow," and a handler that gets this backwards — denying by default when its own logic malfunctions — would be a severe regression, converting every guard bug into a hard stall.**

**Actor**: Hook script (`run-hook.js` and the dispatched guard handler); Claude Code; Developer
**Preconditions**: Any of the 7 guard ids is registered and about to fire; the scenario injects a malfunction into the handler, distinct from the guard's own deliberate deny logic

**Trigger**: A guard invocation encounters a mechanism failure (any of Section 7 UC-3's six shapes) at the exact moment its own deny-decision logic would otherwise have executed

### Primary Flow (The Subtle Case — a Handler That Throws Mid-Decision)
1. `pre:bash:git-guard` is about to resolve the current branch via `git rev-parse --abbrev-ref HEAD` to decide whether to deny a `git commit` on `main`.
2. The `child_process` call throws (e.g. the `.git` directory is corrupted, or the subprocess spawn itself fails for an unrelated OS-level reason) partway through the guard's own logic — after the guard has already begun evaluating this call, not before dispatch.
3. `run-hook.js`'s own dispatch call is wrapped in the identical try/catch Section 7 established for all handlers — this wrapping is **not** guard-specific and is **not** exempted for the code path that would have produced a `deny`; a thrown exception at any point inside the handler, including the exact line that would have set `permissionDecision: "deny"`, is caught by the same outer boundary.
4. `run-hook.js` writes `{"continue": true, "systemMessage": "pre:bash:git-guard: hook failed (exception) — proceeding without it"}` (or equivalent, naming the hook id and reason `exception`) to stdout and exits `0` — critically, **with no `permissionDecision` field of any kind, not even an accidentally-half-constructed `"deny"` from the interrupted logic.**
5. Claude Code applies the `git commit` exactly as if `pre:bash:git-guard` had not fired at all, beyond the visible `systemMessage`.
6. **Mechanically checkable outcome**: exit code `0`; stdout JSON contains no `permissionDecision`/`decision` field; `systemMessage` contains the hook id and the string `exception`; the underlying `Bash`/`Edit`/`Write`/`Stop` event **proceeds** — the opposite of what a naive "when in doubt, block" instinct would produce, and exactly what FR-1.2/FR-1.3 require.

**Postconditions**: The tool call or `Stop` event completes exactly as if the guard had not fired; no guard in this document ever produces a `deny`/`block` as a side effect of its own mechanism failure, under any of Section 7's six failure shapes, for any of the 7 guard ids.

### Alternative Flows
- **UC-14-A1: The same scenario for a `Stop`-event guard (`stop:changelog-guard`)** — the guard's own `git status --porcelain` call or content-parsing logic throws while evaluating a changed `CHANGELOG.md`. Per FR-7.4/FR-1.2, this exits `0` with **no** `decision: "block"` field — `Stop` proceeds unblocked, exactly as UC-12-E4 documents. The distinction from a `PreToolUse` guard's fail-open is only in which field is absent (`decision` vs `permissionDecision`), never in the direction of the outcome.
- **UC-14-A2: A guard's handler exceeds its configured timeout mid-evaluation** (Section 7 UC-3-E2's precedent) — e.g. `pre:write:shrink-guard` hangs reading an unusually large curated file. `run-hook.js` terminates execution at the timeout boundary, exits `0`, no `permissionDecision`, `systemMessage` reason `timeout` — the `Write` proceeds.
- **UC-14-A3: Node is missing or below the minimum version** — identical in kind to Section 7 UC-3-E3/UC-3-E4; the guard never reaches its own decision logic at all, and the surrounding tool call still proceeds (Node-missing: no wrapper process exists to emit output at all, per Section 7's own caveat; Node-too-old: `run-hook.js` starts, detects the shortfall, exits `0` with reason `node-unavailable` before dispatching to any guard's decision logic).

### Error Flows (What Would Constitute a Defect, Not a Passing Scenario)
- **UC-14-E1 (the failure mode this UC exists to rule out)**: A guard's malfunction produces a `deny`/`block` decision instead of a silent proceed — e.g. an uncaught exception is misrouted through a code path that defaults to `permissionDecision: "deny"` "to be safe," or a timeout is treated as equivalent to "the guard would have denied this." This is a defect, not an acceptable degraded state, per FR-1.3's explicit "never a fallback behavior of a crash, a timeout, or a missing Node runtime." A fixture suite for this feature MUST include, for every one of the 7 guards, an injected-malfunction test asserting the absence of any `permissionDecision`/`decision` field in the resulting stdout — not merely the presence of exit `0` — since a buggy implementation could in principle exit `0` while still smuggling a stale `"deny"` value through a half-completed JSON object.

### Edge Cases
- **UC-14-EC1**: A guard's mechanism failure occurs on a call that, had the guard run correctly, would have been an *allow* case anyway (e.g. `pre:bash:git-guard` throws while resolving the branch for a commit that was already on a feature branch) — the observable outcome (proceed) is identical to both a correctly-functioning allow and a fail-open allow; only the `systemMessage`'s presence (naming the failure) distinguishes the two, which is why every guard's fixture suite must inject malfunctions independent of what the "correct" answer would have been, not only on cases that would otherwise have been denied.
- **UC-14-EC2**: Two guards fire on the same tool call and one fails open while the other denies deliberately (e.g. `pre:edit:read-guard`'s mechanism fails open on an `Edit` to `tsconfig.json` while `pre:edit:config-protection` deliberately denies the same call for weakening `strict`) — each guard's outcome is independent; a deny from one guard on a call blocks it regardless of another guard's fail-open on the same call, since `PreToolUse` guards are evaluated by Claude Code's own hook engine per-registration, not merged into a single combined decision by this feature's own code.

### Data Requirements
- **Input**: Crafted stdin fixtures per guard id; a deliberately malfunctioning handler variant per Section 7's six failure shapes, applied to each of the 7 guards
- **Output**: Exit `0` (or, for the Node-missing sub-case, no process at all) in every case; no `permissionDecision`/`decision` field present under any malfunction; a `systemMessage` naming the hook id and canonical reason token where a process does execute
- **Side Effects**: None beyond the `systemMessage` itself; no guard's own side-effect (state-file write) occurs when its own invocation is the one that failed

---

## UC-15: Kill Switches — `SDLC_DISABLED_HOOKS` and `SDLC_HOOKS_ENABLED=0` Suppress All 7 Guards

**Actor**: Developer (sets the environment variable); Hook script (`run-hook.js`, reads it before dispatch — inherited unmodified from Section 7 FR-4.2/FR-4.3)
**Preconditions**: All 7 guard ids are registered (UC-1 through UC-13's preconditions hold)
**Trigger**: `SDLC_DISABLED_HOOKS` and/or `SDLC_HOOKS_ENABLED=0` is set in the environment a session (and every hook child process it spawns) inherits

### Primary Flow (AC-15 — All 7 Guard Ids Listed at Once)
1. Developer sets `SDLC_DISABLED_HOOKS=pre:bash:git-guard,pre:write:shrink-guard,pre:edit:read-guard,pre:edit:config-protection,pre:agent:isolation-guard,stop:changelog-guard,pre:edit:gateguard`.
2. Every guarded tool-call shape exercised across UC-1 through UC-12's block scenarios is issued in sequence: `git commit` on `main`, `git commit --no-verify`, `git add -A`, an AI-attributed commit message, a wrong-scope commit, a plain `git push`, a shrinking `Write` to `docs/PRD.md`, an unread-this-session `Edit`, a `strict: true→false` `tsconfig.json` edit, a subagent `Write` to `.claude/scratchpad.md`, and a shape-defective `CHANGELOG.md` entry at `Stop`.
3. Each of the 7 guard ids checks the comma-separated list before dispatching to any handler logic, finds its own id present, and exits `0` immediately with no `permissionDecision`/`decision` field and no `systemMessage` (suppression is silent by design, distinct from the fail-open `systemMessage` in UC-14 — mirrors `hook-infrastructure_use_cases.md` UC-4's precedent).
4. **Mechanically checkable outcome (AC-15)**: zero denials and zero guard-originated `systemMessage`s across the entire sequence — every call proceeds exactly as if none of the 7 guards existed.

**Postconditions**: With all 7 disabled, guarded behavior is identical to a Section-7-only installation with no guards configured (NFR-3) — every backstop gate documented in UC-1-B, UC-3-B, UC-7-B, UC-8-B, UC-9/10-B, UC-11-B, UC-12-B becomes the sole remaining check for its respective invariant.

### Alternative Flows
- **UC-15-A1: `SDLC_HOOKS_ENABLED=0`** — the global kill switch (inherited unmodified from Section 7) suppresses every hook the plugin registers — all 7 of this feature's guards AND Section 7's original 3 (`session:start:spine`, `post:edit:accumulate`, `stop:typecheck-format`) — identically and simultaneously; behaviorally indistinguishable from the plugin never having been installed at all (`hook-infrastructure_use_cases.md` UC-2), now extended to cover blocking behavior as well as advisory behavior.
- **UC-15-A2: Only some guard ids listed (e.g. `SDLC_DISABLED_HOOKS=pre:edit:config-protection`)** — that one guard alone is inert; the other 6 remain fully active, exactly mirroring `hook-infrastructure_use_cases.md` UC-4-A1's granular precedent for Section 7's 3 hooks, now applied to this feature's 7.
- **UC-15-A3: `pre:edit:gateguard` combined with `SDLC_GATEGUARD=on`** — see UC-13-EC2; the kill switch overrides the opt-in flag.

### Error Flows
- **UC-15-E1**: `SDLC_DISABLED_HOOKS` lists an id with a typo (e.g. `pre:bash:gitguard`, missing the hyphen) — the malformed id never matches any real guard's own id during comparison (comparison is per-invocation against the currently-dispatching hook's own id, not validated as a set up front, per `hook-infrastructure_use_cases.md` UC-4-EC3's precedent); the intended guard remains fully active, which is a silent misconfiguration risk worth flagging in review but is not itself a guard defect.

### Edge Cases
- **UC-15-EC1 (`pre:edit:read-guard`'s dual registration)**: Listing `pre:edit:read-guard` in `SDLC_DISABLED_HOOKS` disables **both** event registrations (the `PostToolUse`/`Read` recorder half and the `PreToolUse`/`Edit|Write` gate half) simultaneously, since `run-hook.js` gates by id before dispatch regardless of which `hooks.json` entry triggered the invocation (FR-4.6) — a partial disable, where the recorder keeps appending to the read record while the gate is inert (harmless but wasteful), or the gate remains active while the recorder stops populating the record (which would then deny every `Edit` regardless of actual read history — a false-positive hazard), MUST NOT occur. A fixture confirming both halves are silenced by the single id is required.
- **UC-15-EC2**: `SDLC_HOOKS_ENABLED=0` and a per-guard escape sentinel (e.g. `SDLC_ALLOW_GIT_GUARD=1`) are both set simultaneously — redundant, not conflicting; the global kill switch already means no guard logic runs to consult the escape sentinel in the first place.

### Data Requirements
- **Input**: `SDLC_HOOKS_ENABLED`, `SDLC_DISABLED_HOOKS` from the process environment at the moment each guard invocation starts
- **Output**: Exit `0` in every suppressed case; no `permissionDecision`/`decision` field; no `systemMessage` about the suppression itself
- **Side Effects**: None from a suppressed invocation for any of the 7 guards

---

## UC-16: CI Regression Assertion Narrowing — the Positive-Control Deny-Path Check

**Actor**: Harness Maintainer; CI (`validate-assets` job)
**Preconditions**: `tests/hooks/test-wrapper.js`'s static source sweep (Section 7's FR-3.5 regression guard) originally scanned all files under `hooks/`, asserting none contains `exit(2)` or `permissionDecision` — a sweep this feature's own 7 guards fail by design, since blocking is their entire purpose
**Trigger**: CI runs `validate-assets`, which now includes both the narrowed sweep and the new positive-control check in the same job (FR-10.3)

### Primary Flow (Narrowed Sweep Still Enforces Section 7's Guarantee)
1. `tests/hooks/test-wrapper.js`'s sweep is narrowed to scan exactly 4 files: `hooks/lib/run-hook.js`, `hooks/handlers/session-start-spine.js`, `hooks/handlers/post-edit-accumulate.js`, `hooks/handlers/stop-typecheck-format.js` (FR-10.1) — the same 4 files Section 7 shipped, not the entire `hooks/` tree.
2. The sweep scans those 4 files for `exit(2)`/`process.exitCode = 2`/`permissionDecision` and finds none — Section 7's non-blocking guarantee for those exact 4 files remains a real, CI-enforced invariant after this feature ships.
3. CI exits `0` for this sub-check (AC-14).

**Postconditions**: Section 7's 3 original hooks (plus their shared wrapper) are still provably incapable of blocking, exactly as before this feature existed.

### Alternative Flows (The Positive Control — Confirming the Opposite for This Feature's 7)
- **UC-16-A1: Every one of the 7 guard handler modules DOES contain at least one deny-capable code path (AC-13)** — `pre-bash-git-guard.js`, `pre-write-shrink-guard.js`, `pre-edit-read-guard.js`, `pre-edit-config-protection.js`, `pre-agent-isolation-guard.js`, `stop-changelog-guard.js`, `pre-edit-gateguard.js` are each scanned for at least one of `permissionDecision: "deny"`, `decision: "block"`, or `process.exit(2)`/`process.exitCode = 2` somewhere in source (FR-10.2). All 7 are found to contain at least one such path; CI exits `0` for this sub-check — proving each guard is mechanically capable of blocking, not merely documented as if it could.

### Error Flows
- **UC-16-E1 (the regression this check exists to catch)**: A future refactor of, e.g., `pre-edit-config-protection.js` accidentally strips its only `permissionDecision: "deny"` code path (a merge conflict resolved incorrectly, or a well-intentioned "simplification" that deletes the deny branch while leaving the rest of the detection logic intact) — the positive-control check finds zero deny-capable paths in that file and exits non-zero, failing CI with a message naming the specific handler file. This is exactly the "guard that looks installed but never runs" defect the roadmap's F2b table warns against, now caught mechanically rather than only by manual review.
- **UC-16-E2 (the inverse regression)**: A future edit to Section 7's `post-edit-accumulate.js` accidentally introduces a `permissionDecision` field (e.g. a copy-paste from one of this feature's guards during an unrelated refactor) — the narrowed sweep (still scanning this exact file, per FR-10.1) finds it and fails CI, exactly as it would have before this feature existed. FR-10.1 explicitly requires narrowing the file *list*, not weakening the assertion itself, specifically so this regression direction remains caught.
- **UC-16-E3**: The narrowed sweep's file list is itself misconfigured to accidentally include one of the 7 new guard handlers — since every one of the 7 legitimately contains a deny-capable path (per UC-16-A1), the sweep immediately fails, self-flagging the misconfiguration rather than silently passing with the wrong scope. AC-14 requires the file list itself be inspected directly in `tests/hooks/test-wrapper.js` to confirm none of the 7 is present, as a check independent of (and stronger than) merely observing the sweep currently passes.

### Edge Cases
- **UC-16-EC1**: Both checks run in the same `validate-assets` CI job that already runs Section 7's hook fixture tests (FR-10.3) — a regression in either direction (a Section 7 hook gaining a deny path, or a Section 8 guard losing one) fails the same job, not two independently-scheduled ones that could silently diverge in coverage over time.

### Data Requirements
- **Input**: The literal source text of all 11 hook-related files under `hooks/` (4 Section 7 + 7 Section 8)
- **Output**: CI exit `0` when the narrowed sweep finds nothing to flag in the 4 Section 7 files AND the positive control finds a deny path in all 7 Section 8 files; non-zero otherwise, naming the specific file and direction of the regression
- **Side Effects**: None — a static source scan, no runtime execution of any handler

---

## UC-17: Autonomy Regression — A Full `/develop-feature` Run Reaches `MERGE READY` With Zero Human Interventions

This is the section's primary acceptance criterion (AC-16) and the single most important scenario in this document — every guard documented above is worthless in aggregate if, together, they stall an unattended run.

**Actor**: Developer (observes only — does not intervene); Claude Code; all 7 guards, active simultaneously
**Preconditions**: All 7 guards enabled at the `standard` hook profile (FR-1.5); **no** `SDLC_DISABLED_HOOKS` entries and **no** per-guard escape sentinel (`SDLC_ALLOW_GIT_GUARD`, `SDLC_ALLOW_SHRINK`, `SDLC_ALLOW_UNREAD_EDIT`, `SDLC_ALLOW_CONFIG_EDIT`, `SDLC_ALLOW_SUBAGENT_WRITE`, `SDLC_ALLOW_CHANGELOG_SHAPE`) set anywhere in the environment at the start of the run
**Trigger**: `/develop-feature` is invoked on a seeded feature in this repository

### Primary Flow (Pass — the Scenario This Feature Exists to Make True)
1. `/develop-feature` runs `/bootstrap-feature` (PRD, use cases, architecture review, QA test cases, implementation plan), then loops `/implement-slice` across every planned slice, then runs `/merge-ready`.
2. Throughout the run, every `Bash`, `Edit`, `Write`, and `Stop` event the model issues passes through whichever of the 7 guards match it.
3. Any denial encountered during the run is one the model can self-resolve through the existing deviation rules (`src/rules/error-recovery.md`, FR-9.6) without asking the user: a self-correctable violation (wrong branch, missing `type(scope):` prefix, an unread file) is fixed and retried for free (Rule 1/2); a guard requiring an explicit environment escape is resolved by the model setting that scoped sentinel for the one call it applies to, costing one retry (Rule 3); a genuine scope question a `GateGuard` investigation surfaces escalates under Rule 4 only if it cannot otherwise proceed — and even then, per this scenario's own success condition, does not require a human to actually answer it during this specific regression run (the seeded feature is chosen such that no Rule-4-requiring ambiguity is expected to arise).
4. `stop:changelog-guard`'s bounded blocking (FR-7.5) never needs to exhaust its 2-consecutive-block cap, because the model corrects the changelog entry's shape by the second attempt at the latest.
5. The run reaches `MERGE READY`.
6. **Mechanically checkable outcome (FR-11.1/FR-11.2)**: the run is a repeatable, scripted test (not a one-off manual observation); its pass/fail result — specifically, that zero denials occurred which the model could not self-resolve through the deviation rules — is recorded in this feature's implementation record.

**Postconditions**: The 7 guards, running together at full strength with no escapes pre-set, did not stall the pipeline anywhere between `/bootstrap-feature` and `MERGE READY`.

### Alternative Flows
- **UC-17-A1: The run encounters and self-resolves at least one denial from each of several different guards** — e.g. an early `git commit` attempted on `main` before the model has switched branches (UC-1, Rule 1 fix), an `Edit` denied for lacking a prior `Read` after a context compaction (UC-8, Rule 1 fix), and a first `GateGuard`-gated edit if `SDLC_GATEGUARD=on` happens to be part of this run's seeded configuration (UC-13, self-resolving by construction per FR-8.4). None of these constitutes a failure of this UC — self-resolution, even with multiple denials along the way, is the expected texture of a healthy run; **zero human interventions**, not **zero denials**, is the success bar (FR-11.1's literal wording).

### Error Flows (What Constitutes a Failure of This Scenario, Described Explicitly)
- **UC-17-E1 (hard failure — a stall)**: A guard denies a call the model cannot self-resolve through Rule 1/2/3/4 within its own retry budget (`src/rules/error-recovery.md`'s 3-retries-per-slice) — e.g. the deny reason's stated remedy is ambiguous or unparseable by the deviation-rule classification, the model repeatedly retries the identical denied call without adjusting its approach, or a guard's own bug produces a deny reason that names no concrete remedy at all (a violation of FR-9.5 in its own right, surfaced here as its downstream consequence) — and the run halts, with no further tool calls issued, waiting on input that never arrives during the scripted test. **This is the literal failure of FR-11.1** and MUST be recorded as such in the implementation record, naming the specific guard and denied call that produced the stall.
- **UC-17-E2 (hard failure — observed human intervention)**: At any point between `/bootstrap-feature` and `MERGE READY`, a human is observed answering a permission prompt, manually exporting an environment variable to unblock a guard, manually editing a file to work around a denial, or manually running a command the model itself should have issued. The scripted test's own harness injecting anything beyond the feature's initial seed description counts as this failure mode, even if no interactive human was literally present — the test is designed to detect "the model needed help," not merely "no person was watching."
- **UC-17-E3 (soft failure — recorded but not necessarily blocking `MERGE READY`)**: `stop:changelog-guard`'s bound-exhaustion (its 3rd-consecutive-failure non-blocking-warning fallback, UC-12-E3) is reached more than once across the whole run. Because the guard stops blocking after 2 consecutive failures by design (FR-7.5), reaching this fallback does not, by itself, halt the run or require a human — but its repeated occurrence indicates the guard's remedy text is not actually self-resolvable by the model in practice (a violation of the spirit of FR-9.6, even where the letter of FR-11.1 is technically satisfied because the run still reached `MERGE READY`). This distinction — between a run that reaches `MERGE READY` cleanly and one that reaches it only by exhausting a blocking guard's bound — MUST be recorded separately in the implementation record; a `MERGE READY` result achieved this way does NOT count as a clean pass of AC-16 and should prompt a review of that guard's message wording before the feature is considered validated.

### Edge Cases
- **UC-17-EC1**: The seeded feature used for this regression test is itself deliberately unremarkable — a small, well-scoped change with no genuine architectural ambiguity — precisely so that a Rule-4 escalation (which this scenario's success condition assumes will not arise) is not conflated with a guard defect; a seeded feature chosen to be deliberately ambiguous would make this test unable to distinguish "the guards work" from "the feature was underspecified," and is therefore an invalid test design, not a valid stress test of the guards themselves.
- **UC-17-EC2**: A single guard denial that is immediately, correctly self-resolved on the very next tool call (the common case) is not distinguishable, in the pass/fail sense, from a run with zero denials at all — FR-11.1's bar is about the model's own autonomy, not about guard silence; a scripted test asserting "zero `Stop`/tool-call events required human input" is the correct assertion, not "zero denials occurred."

### Data Requirements
- **Input**: A seeded feature description; the full `/develop-feature` run's transcript (every tool call, every guard invocation and its outcome, every retry)
- **Output**: A recorded PASS/FAIL result in the implementation record, decomposed into: whether `MERGE READY` was reached; whether any hard failure (UC-17-E1/E2) occurred; whether any soft failure (UC-17-E3) occurred and how many times
- **Side Effects**: The seeded feature's own implementation artifacts (a real slice of code, real commits, a real changelog entry) — this is a real run of the pipeline, not a simulation, and its own side effects are the ordinary side effects of a successful `/develop-feature` run
