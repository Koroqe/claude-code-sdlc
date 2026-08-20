# Use Cases: Post-Live-Run Reconciliation

> Based on [PRD](../PRD.md) — Section 13: Post-Live-Run Reconciliation

---

**System context (do not assume otherwise):** this feature has no UI, no server, and no database
(PRD 13.7–13.9). It is six coordinated fixes reconciling this harness's own code and skill text with
what `docs/findings/live-pipeline-run-2026-08-20.md` and `docs/findings/remeasurement-2.1.237.md`
actually measured about Claude Code 2.1.237's behavior. **No fix adds new capability** — each closes
the gap between a documented/enforced claim and an observed fact. This document groups use cases by
the six FR groups (FR-1 through FR-6) rather than forcing one mega-use-case, because the six touch
disjoint files, have independent actors, and — per NFR-4/NFR-5 — must each be independently verified
never to introduce a new blocking condition.

**Actors common to all six groups:**
- **Developer** — the human running `install.sh`, committing code, or reading skill text. Triggers FR-1 and reads FR-6's corrected wording; never directly triggers FR-2–FR-5.
- **`pre:edit:read-guard`** (`hooks/handlers/pre-edit-read-guard.js`) — the actor for FR-3. A `PreToolUse`/`PostToolUse` hook pair, spawned per tool call within a session.
- **`subagent:stop:wave-record`** (`hooks/handlers/subagent-stop-wave-record.js`) — the actor for FR-4. Fires on `SubagentStop`, once per subagent.
- **`stop:gate-evidence`** (`hooks/handlers/stop-gate-evidence.js`) — the actor for FR-5. Fires on `Stop`, once per main-loop turn.
- **`git status` / CI / the `debugger` agent** — passive observers of FR-2's `.gitignore` entry.
- **`plan-critic`, `session:start:spine`'s validators (`validate-triage-parity`, `validate-instinct-discipline`)** — the constraint-holders for FR-6; they must keep passing unmodified through this feature's edits.

**The organizing principle:** every flow below ends in a mechanically checkable outcome — a file's
byte content, a grep result, a JSON record's field, a guard's allow/deny decision — exactly what
`docs/qa/post-live-run-reconciliation_test_cases.md` and `tests/hooks/test-*.js` are meant to encode.
Per NFR-5 and each group's own "no widening" requirement, **every error/fail-open flow below must
converge on today's behavior, never a new refusal or a new block.**

---

## Group A (FR-3): `pre:edit:read-guard` Write-then-Edit Fix

**Mechanism correction (per the architect's FAIL-verdict fix, FR-3.2):** the original framing of this
group described the *recorder half of the handler* as the defect. It is not. `hooks/lib/read-tracker.js`'s
`recordRead` already records whatever `PostToolUse` target path it is handed, regardless of tool name —
nothing inside the handler body ever discriminated `Read` from `Write`. **The actual defect, and the
only correct fix, is `hooks/hooks.json`'s registration**: the `PostToolUse` matcher for hook id
`pre:edit:read-guard` is `"Read"` only, so a `Write`'s `PostToolUse` event is never routed to the
handler at all — it is filtered before the handler's code ever runs. FR-3.2 widens that matcher from
`"Read"` to `"Read|Write"`. Every use case below is written against this corrected mechanism: the fix
is entirely declarative (a `hooks.json` matcher string), with two small defensive additions to the
handler body (FR-3.6) to keep the now-wider event stream safe.

**Actor**: `pre:edit:read-guard`, and — for UC-A1's own postcondition to be checkable at all — `hooks/hooks.json`'s
registration itself, since a behavior-only test can pass green without the matcher actually being widened
(AC-3's config-level assertion, UC-A1-EC4).
**Preconditions**: A session is active (`session_id` present); the guard's per-session freshness
record (`hooks/lib/read-tracker.js`, `<sessionId>.reads`) exists or does not yet exist; `SDLC_ALLOW_UNREAD_EDIT`
may or may not be set in the environment; `hooks/hooks.json`'s `PostToolUse` matcher for `pre:edit:read-guard`
is `"Read|Write"` (post-fix) or `"Read"` (pre-fix, the defect state).
**Trigger**: A `PreToolUse` call on `Edit` or `Write` against a file that already exists on disk (a
brand-new-file `Write` is out of scope — the guard already exempts it, per the handler's existing
`if (!exists) return null` branch).

### UC-A1: Write Then Edit — Guard Passes (Primary Flow, the defect this group fixes)

1. Earlier in the same session, the model issues a `Write` that creates or fully replaces `docs/findings/example.md`.
2. Claude Code fires `PostToolUse`; because `hooks/hooks.json`'s matcher for id `pre:edit:read-guard` is now `"Read|Write"` (FR-3.2), this `Write` event is routed to the handler — pre-fix, with the matcher still `"Read"`, this event would never have reached the handler at all, regardless of what the handler's body does.
3. The handler's recorder half runs unchanged: it records the target path into the freshness tracker, exactly as it already does for a `Read` — the recorder was never tool-name-discriminating; only the routing was.
4. Later in the same session, with no intervening `Read` of that file, the model issues an `Edit` to `docs/findings/example.md`.
5. `PreToolUse` fires; the guard resolves the target's freshness state and finds the earlier `Write` recorded.
6. The guard returns `null` (allow) — no deny payload is constructed.
7. The `Edit` proceeds normally.

**Postconditions**: The `Edit` was never refused; no `[deviation: rule-1 ...]` message was surfaced; the freshness tracker's record for the file shows evidence from the `Write` event; `hooks/hooks.json`'s `PostToolUse` registration for id `pre:edit:read-guard` carries a matcher matching `Write` (AC-3's seeded "Write, then Edit, no intervening Read" case, plus its required config-level assertion).

### Alternative Flows
- **UC-A1-A1: Read-then-Edit — unchanged.** A `Read` of an existing file followed later by an `Edit` to it, with no intervening `Write`, passes exactly as it does today (FR-3.3, "Read-then-Edit behavior is unchanged"). `Read`'s `PostToolUse` routing (matcher `"Read"`) was never the defect and is untouched by widening the matcher to `"Read|Write"` — the widened matcher is additive, not a replacement. This is a non-regression check, not new behavior — it exists in this document because FR-3.3 explicitly requires it to survive FR-3.2's change untouched.
- **UC-A1-A2: Write, then a second Write, then Edit — still passes.** Multiple same-session `Write`s to the same file each independently satisfy freshness; the guard does not require the most recent event to be a `Write` specifically, only that some `Write` or `Read` of the file occurred this session, each now reaching the recorder because both are included in the widened matcher.
- **UC-A1-A3: Read, then Write, then Edit — still passes (mixed evidence).** Freshness evidence from different event types for the same file is additive, never mutually exclusive; the guard's `wasRead`-equivalent check accepts a match against either kind of recorded evidence, both now routed to the recorder by the same single matcher.

### Error / No-Widening Flows
- **UC-A1-E1: Edit with neither Read nor Write recorded — still refused (the guard's core purpose, must survive unchanged).** The model issues an `Edit` to a pre-existing file it has neither `Read` nor `Write`-touched this session. The guard's freshness lookup finds no evidence of either kind, returns `'no'` (fact about state, not a mechanism failure), and the guard denies with the existing message naming the remedy ("Read it first ... Override with `SDLC_ALLOW_UNREAD_EDIT=1`") and the `[deviation: rule-1]` tag. FR-3.3 states explicitly this fix "narrows no existing protection" — this flow is the proof that the narrowing did not happen (AC-3's seeded "no Read, no Write" case).
- **UC-A1-E2: override env var, with the fix in place — unchanged semantics.** With `SDLC_ALLOW_UNREAD_EDIT=1` set and no freshness evidence recorded for the target, the guard still reaches the deny branch's evaluation but short-circuits to an allow with a `systemMessage` noting the bypass, byte-identical to pre-fix behavior (FR-3.4: "no new override, no removed override, no changed variable name or semantics"). This flow also confirms the override is orthogonal to FR-3.2 — a session with genuine `Write` evidence never needs the override, and a session using the override never needs `Write` evidence either.
- **UC-A1-E3: a Write denied by another guard must NOT count as freshness — because the tool call never executed, so no `PostToolUse` fires.** The model issues a `Write` to `.claude/scratchpad.md` that `pre:write:shrink-guard` refuses at `PreToolUse` (e.g., it would shrink a tracked section below the guard's floor). The `Write` tool call never completes — no `PostToolUse` fires for it at all, regardless of the widened matcher, because Claude Code only emits `PostToolUse` for a tool call that actually ran. Consequently `pre:edit:read-guard`'s recorder never runs for that call, and no freshness evidence is recorded. A subsequent `Edit` to `.claude/scratchpad.md` with no other freshness evidence is still refused by UC-A1-E1's flow, unchanged. **This is exactly why FR-3.5(a) forbids recording freshness at `PreToolUse` time inside the read-guard itself**: a `PreToolUse`-time recording would seed freshness before the sibling guard's refusal is even known, since inter-hook-group ordering between `PreToolUse` guards is not guaranteed — the widened-`PostToolUse`-matcher design is immune to this by construction, because it only ever sees events for tool calls that already executed.
- **UC-A1-E4: a Write that executed but errored — does not mint freshness where the error is detectable, fails open to recording where it is not (FR-3.6a).** A `Write` tool call reaches `PostToolUse` (it executed) but its `tool_response` carries an error indication (e.g., a permission failure surfaced post-execution, or a partial-write failure the tool itself reports). The recorder inspects `tool_response` for an error indication where the payload shape makes one detectable, and in that case does NOT record freshness for the target — an errored write is not evidence the model has current, correct knowledge of the file's contents. Where the error-indication shape is ambiguous or absent from the payload (an unknown or missing `tool_response` shape), the recorder fails OPEN to recording — per FR-3.6a, "an ambiguous or absent error indicator does not block recording." This asymmetry is deliberate: a detected error must not mint false freshness, but an *undetectable* error must not turn into a wall of spurious refusals on a later `Edit` either — the same fail-open discipline the guard's `wasRead`/`'unknown'` case already applies elsewhere.
- **UC-A1-E5: `tool_name` absent from the `PostToolUse` payload — defaults to recording, not to skipping (FR-3.6b).** A defensive `tool_name` check reads the incoming payload's `tool_name` field to help route recording logic. If `tool_name` is absent entirely (a payload-shape variation this handler has not seen before), the handler does NOT refuse to record on the theory that an unrecognized shape might not be `Read`/`Write` — it defaults to recording. FR-3.6b names the reason explicitly: "a strict allowlist (record only if `tool_name` is exactly `"Read"` or `"Write"`) would turn a future payload-shape change into mass false refusals" on later `Edit`s, so an absent `tool_name` is treated permissively, favoring the same "denied evidence is worse than over-recorded evidence" asymmetry the guard's design already embodies for `Read`.

### Edge Cases
- **UC-A1-EC1: Write to a file the model has never read, immediately followed by Edit, spanning a compaction boundary.** If context compaction occurs between the `Write` and the `Edit`, the on-disk freshness record (not the model's own memory) is what the guard consults — the record persists across compaction because it lives in `hooks/lib/read-tracker.js`'s session file, not in context. The `Edit` still passes, because the record, not the model's recollection, is authoritative (this is the same design principle the guard's own header comment states for `Read`).
- **UC-A1-EC2: garbage-collected freshness record.** If the session's `.reads`-equivalent record was garbage-collected (stale, >24h, per the tracker's existing `collectGarbage`) between the `Write` and the `Edit`, the lookup returns `'unknown'` (mechanism failure, not "no"), and the guard allows — this is pre-existing behavior, exercised identically whether the missing evidence was a `Write` or a `Read`.
- **UC-A1-EC3: `Write` to a `notebook_path` (Jupyter) target.** The guard's `target` resolution already falls back to `notebook_path` when `file_path` is absent; FR-3.2's fix applies identically regardless of which field supplied the target, since the freshness tracker keys on the resolved `target`, not the field name it came from, and the widened matcher routes the `PostToolUse` event to the handler the same way for either field.
- **UC-A1-EC4: a behavior-only test can pass green without the matcher fix actually shipping — the reason for AC-3's config-level assertion.** The existing test harness invokes handlers directly by id, bypassing Claude Code's own matcher routing entirely — so a test that only calls the handler function with a synthetic `Write` `PostToolUse` payload would pass whether or not `hooks/hooks.json`'s matcher was ever widened, because the test never exercises routing at all. `tests/hooks/test-guard-read.js` therefore also asserts, directly against the parsed `hooks/hooks.json` content, that the `PostToolUse` registration carrying id `pre:edit:read-guard` has a matcher matching `Write` — a config-level check with no handler invocation involved, required because the behavior-level tests structurally cannot catch a missing matcher change.
- **UC-A1-EC5: the two forbidden alternative mechanisms, named explicitly, are not what ships (FR-3.5).** (a) Recording freshness at `PreToolUse` time inside `pre:edit:read-guard` itself is forbidden — UC-A1-E3 is the concrete failure mode this would reintroduce. (b) Piggy-backing on `post:edit:accumulate` to seed freshness is forbidden — described in FR-3.5(b) as "cross-hook coupling that breaks the shared-id kill-switch contract," and would let a plain `Edit` mint freshness for itself, which is incoherent (an `Edit` cannot be evidence that the file was known-fresh *before* the edit that changed it). Neither alternative appears in any use case above as an accepted path; their absence is intentional and enforced by plan-critic / code review recognizing either pattern as a BLOCKER-tier deviation from FR-3.2/FR-3.5, not merely a style choice.

### Data Requirements
- **Input**: `hook_event_name` (`PostToolUse` | `PreToolUse`), `tool_input.file_path`/`notebook_path`, `tool_name`, `tool_response` (for error-shape detection), `cwd`, `session_id`, `process.env.SDLC_ALLOW_UNREAD_EDIT`; `hooks/hooks.json`'s own declared matcher string for id `pre:edit:read-guard`
- **Output**: allow (`null`) or deny (`{ deny: { reason } }`) for `PreToolUse`; no return-value effect for `PostToolUse` (recorder only, structurally incapable of blocking)
- **Side Effects**: appends a line to the session's freshness record file on a `Write` (new, now routed by the widened matcher) or `Read` (existing) `PostToolUse` — except where an errored `Write` is detected per UC-A1-E4; no side effect on `PreToolUse`

---

## Group B (FR-4): `subagent:stop:wave-record` — Record `agent_type`

**Actor**: `subagent:stop:wave-record`
**Preconditions**: `SubagentStop` has fired; `input.agent_transcript_path` is a readable regular file ≤ 4 MiB; `.claude/debug/wave-results/` is writable.
**Trigger**: A subagent completes and Claude Code emits `SubagentStop`.

### UC-B1: `agent_type` Present — Recorded (Primary Flow)

1. A subagent (e.g. `code-reviewer`) finishes; Claude Code fires `SubagentStop` with a payload carrying `agent_type: "code-reviewer"` (per `docs/findings/remeasurement-2.1.237.md` §3, confirmed on 2.1.237) alongside the existing `agent_transcript_path`, `agent_id`.
2. The handler reads and summarizes the transcript exactly as today (`commands`, `files_written`, `tool_counts`, `tool_results_errored`, `final_text` — FR-4.2's "MUST NOT alter any other field").
3. The handler validates `input.agent_type` against the bound `/^[A-Za-z0-9:_-]{1,64}$/` (FR-4.2); `"code-reviewer"` matches, so it is included as a new `agent_type` field in the JSON object written to `.claude/debug/wave-results/<safeId>.json` (FR-4.1). The same bound is applied to the record body's separate `agent_id` field in the same slice (FR-4.4) — see UC-B1-EC1 for the corrected detail that only the filename derivation was previously sanitized, not the record body.
4. The record is written as before, now containing `agent_type: "code-reviewer"` alongside the pre-existing fields.

**Postconditions**: the wave-record file for this subagent contains `agent_type: "code-reviewer"`; every pre-existing field is present, unchanged in shape and content, compared to a payload without this fix (AC-4's seeded case), and the record body's `agent_id` field is bounded by the same regex as `agent_type` (AC-4).

### Alternative Flows
- **UC-B1-A1: `agent_type` absent (older CLI) — record still written, no error, key omitted (never `null`).** The payload carries no `agent_type` field (an older Claude Code build, per FR-4.2). The handler writes the record with the `agent_type` key entirely absent — never present as `agent_type: null` — and does not throw. All other fields (`commands`, `files_written`, `tool_counts`, `tool_results_errored`, `final_text`, `agent_id`, `recorded_at`) are written exactly as they were before this fix shipped.
- **UC-B1-A2: existing on-disk records are never touched.** A wave-record file already on disk from a prior session (written before this feature shipped, necessarily with no `agent_type` field) is not rewritten, migrated, or invalidated by this fix — the handler only ever writes a new file per `SubagentStop` invocation; it has no code path that opens or edits a prior record (FR-4.3).

### Error / Fail-Open Flows
- **UC-B1-E1: `agent_transcript_path` missing or not a string — unchanged early return.** `input.agent_transcript_path` is absent or non-string; the handler returns `null` immediately, exactly as before this fix — `agent_type` extraction never runs because the function returns before reaching it.
- **UC-B1-E2: transcript unreadable, oversized, or malformed — unchanged fail-open.** `fs.statSync` throws, the file exceeds `MAX_TRANSCRIPT_BYTES`, or the file is not a regular file; the surrounding `try`/`catch` swallows the error and the function returns `null` without writing a record — identical to pre-fix behavior, and independent of whether `agent_type` was present in the (never-reached) payload.
- **UC-B1-E3: `.claude/debug/wave-results/` unwritable.** `fs.mkdirSync`/`fs.writeFileSync` throws (permissions, disk full); caught by the same top-level `try`/`catch` that already protects the write today; the handler returns `null`. `SubagentStop` is never blocked (the handler's own header comment: "It never blocks").

### Edge Cases
- **UC-B1-EC1: hostile/odd `agent_type` values — explicit bound, omit-on-failure (corrected; `agent_id`'s record body is bounded identically in the same slice, FR-4.4).** Before this correction, the document assumed `agent_id`'s record-body field was already bounded/sanitized the same way its filename derivation (`safeId`) is — it is not: only the filename is sanitized (`agentId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)`), while the `agent_id` value written into the JSON body itself is today unbounded. FR-4.2/FR-4.4 close this for both fields in the same slice:
  1. `agent_type` is accepted into the record only when `typeof agent_type === 'string'` AND it matches `/^[A-Za-z0-9:_-]{1,64}$/` (the `:` admits plugin-prefixed types, e.g. `claude-code-sdlc:code-reviewer`).
  2. A value failing either check — non-string, empty, over 64 characters, or containing a character outside `[A-Za-z0-9:_-]` (embedded newlines, backticks, markdown syntax, control bytes) — is never coerced or truncated to fit the pattern. The `agent_type` key is OMITTED from the record entirely: **absent, never written as `null`, never written as a truncated fragment.**
  3. **`agent_id`'s record-body field is a KEY, not an optional attribute, so it does NOT follow `agent_type`'s omit-on-failure semantics.** It is bounded the same way (accepted only as a string matching `/^[A-Za-z0-9:_-]{1,64}$/`), but per FR-4.4 (as amended) and QA TC-B9, a value failing that bound FALLS BACK to the already-computed `safeId` rather than being omitted — the key is always present, never empty, and defaults to `'unknown'` when `safeId` itself is the fallback value (the same `'unknown'` default the filename derivation already falls back to when `agent_id` is absent). Only `agent_type` is ever omitted from the record on bound failure; `agent_id` never is.
  4. **Consequence of `safeId` and the body bound diverging in what they strip:** `safeId`'s filename derivation strips `:` (`agentId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)` — its allowed set has no `:`), while the body's bound pattern `/^[A-Za-z0-9:_-]{1,64}$/` admits `:`. So a colon-bearing `agent_id` (e.g. `claude-code-sdlc:code-reviewer`) legitimately passes the body bound and is written into the record body verbatim, while the filename derived from the same raw value has its colons stripped — the filename and the body's `agent_id` field are allowed to differ by design, and this is not a bug to reconcile.
  5. Neither `agent_type` nor `agent_id` is ever used in path construction beyond the pre-existing, independently-sanitized `safeId` — the bound exists to protect the JSON record body's contents, not the filename, which already had its own (different, character-replacing rather than omit-on-failure/fallback) sanitization.
- **UC-B1-EC2: `agent_type` present but empty string — OMITTED, not recorded as-is (aligned to FR-4.2; authoritative resolution of a prior TC-B11 conflict).** `agent_type: ""` fails the `/^[A-Za-z0-9:_-]{1,64}$/` bound exactly like any other bound failure (the pattern requires `{1,64}`, so a zero-length string never matches) — it is treated identically to UC-B1-A1's absent case: the `agent_type` key is OMITTED from the record entirely, never written as `agent_type: ""` and never written as `null`. Downstream consumers (Group C / FR-5) see no `agent_type` key at all for such a record, which already degrades cleanly to "not observed" per UC-C1-A2 — there is no separate "empty string present" case for Group C to handle.
- **UC-B1-EC3: concurrent subagents in the same wave writing distinct records.** Two subagents completing near-simultaneously (parallel wave) each fire independent `SubagentStop` events with distinct `agent_id`s and (potentially) distinct `agent_type`s; each writes to its own `<safeId>.json`, so no write races or overwrites another's record — unchanged by this fix, since the filename derivation (`safeId` from `agent_id`) is untouched.

### Data Requirements
- **Input**: `input.agent_transcript_path`, `input.agent_id`, `input.agent_type` (new), `ctx.cwd`/`input.cwd`
- **Output**: a JSON file at `.claude/debug/wave-results/<safeId>.json` containing the existing fields plus (when present) `agent_type`
- **Side Effects**: one file write under `.claude/debug/wave-results/`; no other file touched; never blocks `SubagentStop`

---

## Group C (FR-5): `stop:gate-evidence` — Observable, Non-Blocking Attribution (corrected per architecture review)

**Redesign note (supersedes the original "per-gate attribution upgrade" framing):** the architect's preferred option makes attribution purely *advisory*. The deny/allow **decision logic is byte-identical to today in every case** (FR-5.2) — this fix adds no new blocking condition whatsoever. What it adds, on the allow path only, is a `systemMessage` (the wrapper already supports `systemMessage` on `Stop`) naming which gate-relevant agent types were and were not observed. Wave-records are strictly OPTIONAL, bounded enrichment for that message, never an input to the decision (FR-5.3, FR-5.7). Every use case below is written to assert the `systemMessage`'s content, never a change in allow/deny outcome.

**Actor**: `stop:gate-evidence`
**Preconditions**: FR-4 has already shipped in this feature (FR-5.1 — the enrichment path reads a field FR-4 adds; sequenced strictly after Group B in the implementation plan). `Stop` has fired; `input.transcript_path` is set.
**Trigger**: The main loop's turn ends (`Stop`) after producing a response.

### UC-C1: `MERGE READY` Claimed, Subagents Ran — Allow, With Attribution `systemMessage` (Primary Flow)

1. A `/merge-ready` run dispatches `code-reviewer`, `security-auditor`, `build-runner`, and `verifier` as subagents; each completes, and Group B's fix means each one's wave-record carries a bounded, allowlist-matching `agent_type` (or the plugin-prefixed form, e.g. `claude-code-sdlc:code-reviewer`).
2. The main loop's final turn states a `MERGE READY` verdict.
3. `Stop` fires; the handler reads the transcript tail (unchanged `readTail`/`MAX_BYTES` mechanism) and detects the verdict claim exactly as today (`VERDICT_RE`, `NOT_A_CLAIM` unchanged); it also finds `sawSubagent === true` from the transcript's `isSidechain` scan — the same decision input as today, computed the same way.
4. The decision step is unchanged: `sawSubagent` is true, so the handler does not deny — this is the identical branch today's handler already takes (FR-5.2, FR-5.4: "decision logic ... is BYTE-IDENTICAL").
5. As enrichment layered on top of that unchanged decision, the handler separately scans `.claude/debug/wave-results/*.json` (bounded: max 64 files, max 64KB read per file, resolved from `input.cwd` under `hooks/lib/accumulator.js`'s existing `pathIsSafe` discipline — FR-5.3), matches each record's `agent_type` against the FIXED allowlist (`code-reviewer`, `security-auditor`, `build-runner`, `verifier`, with plugin-prefix tolerance) via strict string comparison — no substring matching, no pattern coercion.
6. All four allowlist types are matched among the scanned records. The handler returns `null` (allow) together with a `systemMessage` naming all four as observed — e.g. `"gate evidence observed: code-reviewer, security-auditor, build-runner, verifier"` — built entirely from the fixed allowlist strings, never from record-derived text (FR-5.3: "No record-derived text is ever interpolated into any deny reason or systemMessage — only the fixed allowlist names ever appear in emitted text").

**Postconditions**: the response is allowed, identically to what today's pre-upgrade handler would have done for the same transcript (AC-5: "the decision behavior is BYTE-IDENTICAL before and after this upgrade for every seeded input"); the return value additionally carries `systemMessage` naming the four allowlist types as observed, asserted via `r.json.systemMessage` in `tests/hooks/test-stop-gate-evidence.js` per AC-5.

### Alternative Flows
- **UC-C1-A1: some allowlist types missing from wave-records — `systemMessage` names the gap, decision unchanged.** Wave-records exist for `code-reviewer` and `build-runner` only (`security-auditor` and `verifier` never ran, or their records are unreadable/absent). The decision is still governed solely by `sawSubagent` from the transcript — unaffected by which specific types were recorded — so if any subagent ran, the response is still allowed exactly as before. The `systemMessage` names both what was observed (`code-reviewer`, `build-runner`) and what was not (`security-auditor`, `verifier`) among the four allowlist names, e.g. `"gate evidence observed: code-reviewer, build-runner — not observed: security-auditor, verifier"`.
- **UC-C1-A2: `agent_type` absent on all wave-records — graceful degradation, decision unchanged, message says so.** No wave-record carries a bound-passing `agent_type` — either because the records predate this feature (FR-4.3), an older CLI never sent the field, or every value failed FR-4.2's bound and was omitted. Per FR-5.5, every such record contributes to the `systemMessage`'s "not observed" side, and the decision (governed by `sawSubagent` alone, as today) never changes because of this absence. Verified against AC-5's "byte-identical" seeded case with no `agent_type` field on any record.
- **UC-C1-A3: non-MERGE-READY response — untouched.** The main loop's final text does not contain the `MERGE READY` verdict pattern (or matches `NOT_A_CLAIM`, e.g. "NOT MERGE READY"); the handler returns `null` before any attribution/enrichment logic runs at all — no `systemMessage` is attempted, identical to today.

### Error / Fail-Open Flows
- **UC-C1-E1: wave-record files unreadable — enrichment skipped, decision unaffected (FR-5.6).** The directory `.claude/debug/wave-results/` is absent, unreadable, or contains malformed JSON files, or `pathIsSafe` refuses the resolved directory; the enrichment scan yields nothing, no `systemMessage` is attached (or it is attached noting nothing could be read — implementation detail, either is acceptable), and — critically — the decision is completely unaffected: it was never sourced from wave-records to begin with. "A failure to read wave-records only means the systemMessage enrichment is skipped, never that the decision changes" (FR-5.6).
- **UC-C1-E2: transcript itself unreadable.** `readTail` returns `null` (unchanged from today); the handler returns `null` immediately — "cannot read the transcript means cannot establish anything ... it must equally never block." No enrichment is attempted because the function returns before reaching that step.
- **UC-C1-E3: zero subagents ran at all, verdict claimed — still blocks, the ONE unchanged blocking condition.** The single blocking condition the handler has ever had — a `MERGE READY` claim with zero subagent invocations across the whole session (`sawSubagent === false`) — is preserved exactly, because the decision logic is byte-identical (FR-5.2, FR-5.4). This flow is the proof that the sole existing blocking path still fires, with the same deny message and `SDLC_ALLOW_UNEVIDENCED_GATES` escape hatch, and that the enrichment/`systemMessage` machinery — which only ever runs on the allow path per UC-C1's own flow — plays no role in it.
- **UC-C1-E4: `SDLC_ALLOW_UNEVIDENCED_GATES=1` set — unchanged escape.** With the override set, the handler returns `null` before any transcript read, exactly as today; the override's semantics are not touched by this upgrade, and no `systemMessage` is attempted along this short-circuit path.

### Edge Cases
- **UC-C1-EC1: `agent_type` present but not on the fixed allowlist.** A record carries `agent_type: "general-purpose"` (the value actually observed live per `docs/findings/remeasurement-2.1.237.md` §3, and the historical default before per-role subagent typing) or some other non-gate string. Per FR-5.3's strict string comparison against the fixed allowlist, this record simply does not match any of the four names — it contributes nothing to the `systemMessage`'s "observed" side and nothing to "not observed" either (it is neither; it is out-of-vocabulary for this feature). It never affects the decision, which does not consult `agent_type` at all.
- **UC-C1-EC2: an empty-string `agent_type`, or an `agent_type` that fails FR-4.2's bound and was omitted from the record.** Per Group B (UC-B1-EC2), an empty string fails the `/^[A-Za-z0-9:_-]{1,64}$/` bound like any other invalid value and is never written to the record at all — there is no empty-string case reaching Group C, since Group B omits rather than writes an empty/invalid `agent_type`. A record with no `agent_type` key present is treated identically to UC-C1-A2: it contributes to "not observed," never to a false match against any allowlist name.
- **UC-C1-EC3: replayed/duplicate wave-record files for the same `agent_id` from an interrupted prior run.** The enrichment scan reads whatever is on disk, bounded at 64 files; duplicate or stale records at most cause a redundant "observed" entry for a type already matched (the `systemMessage`'s allowlist names are deduplicated — each of the four ever appears at most once), never a false attribution for a gate that did not actually run, and — again — never any change to the decision, which does not read wave-records at all.
- **UC-C1-EC4: current handler contract read and preserved before implementation (FR-5.4 process requirement).** Before writing the upgraded handler, its author reads the existing contract (what it blocks today, what evidence it already accepts) and confirms the decision path is left byte-for-byte untouched — this is a documentation/process use case as much as a runtime one, and is the source of AC-5's non-regression assertion.
- **UC-C1-EC5: the 64-file / 64KB-per-file enrichment bound is exceeded.** More than 64 files exist under `.claude/debug/wave-results/`, or one exceeds 64KB; the scan reads only up to the bound (the first 64 files by whatever order `fs.readdirSync` returns, each capped at 64KB) rather than throwing or reading unbounded — a partial enrichment (some allowlist types under-observed relative to what actually ran) is an acceptable, bounded degradation of the advisory message, never a decision change and never an unbounded read.

### Data Requirements
- **Input**: `input.transcript_path` (decision source, unchanged); `.claude/debug/wave-results/*.json` (new read, OPTIONAL enrichment only, sourced from Group B's output, bounded to 64 files / 64KB each, each record's `agent_type` field matched against the fixed allowlist)
- **Output**: allow (`null`, optionally with `systemMessage`) or deny (`{ deny: { reason } }`) — both the deny reason text and its trigger condition are byte-identical to pre-fix behavior in every case; `systemMessage` is new, additive, and appears only on the allow path, built exclusively from the fixed allowlist names
- **Side Effects**: none — read-only over the transcript and wave-record directory; never writes; no record-derived text ever reaches any emitted output

---

## Group D (FR-1): `install.sh` De-Obsolescence

**Actor**: Developer (runs `install.sh`); `install.sh` itself (SENSITIVE PATH — full pipeline, not a standalone doc edit, per FR-1.6)
**Preconditions**: A machine with `bash`, `git`, optionally `claude` on `PATH`.
**Trigger**: `bash install.sh [options]`, interactively or via `curl | bash`, with or without `--yes`, `--init-project`, `--scope project`.

### UC-D1: Fresh User-Scope Install — Banner Replaced With Verification Guidance (Primary Flow)

1. A developer with no prior install runs `curl -fsSL <raw-url>/install.sh | bash`.
2. The memory layer is copied to `~/.claude` exactly as before this fix (FR-1.4: "no file is written differently, no flag's effect changes, no exit code changes").
3. `install_plugin()` runs, installing and enabling the plugin at user scope — unchanged.
4. `print_next_step()` (the closing banner) no longer prints `"ONE STEP LEFT — required, per project"` or the "The plugin is installed but does NOT load until you enable it in a project" claim (FR-1.1 — re-measurement, `docs/findings/remeasurement-2.1.237.md` §1, proved this false: user-scope enablement alone loaded all 15 agents and fired hooks on 2.1.237, headless).
5. In its place, the banner names the replacement guidance: open a NEW session, run `claude plugin list`, and expect `Scope: user` and `✔ enabled` against the `claude-code-sdlc` entry (FR-1.3).
6. `print_footer()` completes; the script exits 0.

**Postconditions**: `install.sh` grep-clean of the removed banner text and of "required" near "project" in messaging (AC-1); the replacement text names `claude plugin list`, `Scope: user`, and `✔ enabled`; every non-messaging effect (files written, `.sdlc-receipt` content, exit code) is byte-identical to a pre-fix run given the same inputs (FR-1.4).

### Alternative Flows
- **UC-D1-A1: `--init-project` path — per-project messaging audited too.** A developer runs `bash install.sh --init-project`. `scaffold_project()`'s file-writing behavior (`.claude/CLAUDE.md`, `docs/PRD.md`, `.gitignore`, etc.) is unmodified. `enable_plugin_for_project()` still runs and still installs the plugin at project scope for the scaffolded project — FR-1.5 requires project-scope installs to remain fully supported. What changes is only the surrounding messaging: `print_next_step()`'s `INIT_PROJECT = true` branch ("Already done for this project. For any OTHER project, run: ...") is rewritten so it no longer frames the per-project step as required in general — it correctly scopes the "required on Claude Code 2.1.x" framing to whatever FR-1.1's re-measurement actually established, or removes the framing if the re-measurement showed project scope is no longer necessary at all for the *current* project. Any other "required"-adjacent messaging inside `install_plugin()`'s comments/echoes (e.g. "To activate it in a project (required on Claude Code 2.1.x)") is audited and reconciled identically (FR-1.2).
- **UC-D1-A2: `--scope project` continues to work unmodified.** A developer runs `cd your-project && claude plugin install claude-code-sdlc@claude-code-sdlc --scope project` (the command the corrected banner still names as valid, per FR-1.5 — "Project-scope installs remain valid for version pinning"). This is a `claude` CLI invocation, not `install.sh` itself, but AC-1 requires it to "still complete and install at project scope when invoked" as part of this fix's acceptance — i.e., nothing this fix does to `install.sh`'s messaging removes or breaks the capability the corrected banner points at.
- **UC-D1-A3: `claude` not on `PATH`.** `install_plugin()`'s existing fail-open branch (memory layer installs, plugin step prints two manual commands) is unchanged by this fix — it is a capability path, not a per-project-required claim, and is out of FR-1's removal scope.
- **UC-D1-A4: `--no-plugin`.** `print_next_step()` returns immediately (`NO_PLUGIN = true` short-circuit, unchanged) — no banner of any kind is printed, so there is nothing for this fix to alter in this path; a regression here would mean the guard clause itself broke, which this fix must not touch.

### Error Flows
- **UC-D1-E1: non-interactive without `--yes`, no `/dev/tty`.** `confirm()`'s existing refusal ("No terminal available for confirmation ... Re-run non-interactively with --yes") is untouched by this fix — it is unrelated wording, not per-project-required messaging.
- **UC-D1-E2: marketplace add fails silently (the documented 2.1.9 quirk).** `install_plugin()`'s existing re-read-based success detection (`claude plugin marketplace list | grep -q ...`) and its `log_warn` fallback instructions are unchanged; this fix touches only `print_next_step()` and `--init-project`'s per-project claims, not the marketplace-add failure path.
- **UC-D1-E3: `--dry-run` combined with `--init-project` or a plain install.** Any `--dry-run` path that never reaches `print_next_step()` or `enable_plugin_for_project()`'s live execution is unaffected — this fix changes printed text along paths that do execute, not the dry-run reporting mechanism itself.

### Edge Cases
- **UC-D1-EC1: grep verification is text-based, per AC-1.** AC-1's verification method is explicit: grep across `install.sh` for the removed banner text, and for "required" near "project" in `--init-project` messaging. A rewritten banner that still contains the literal substring `"ONE STEP LEFT — required, per project"` anywhere in the file (including in a comment) fails this check — the removal must be textual and complete, not merely reworded elsewhere.
- **UC-D1-EC2: `install.sh`'s own header comment and design-rationale comments referencing the per-project step.** Comments explaining *why* the script drives `claude plugin ...` (e.g. "To activate it in a project (required on Claude Code 2.1.x)") are messaging in the broad sense the audit (FR-1.2) covers, even though they are not user-facing echo output — reconciled to avoid leaving a stale rationale that contradicts the corrected banner even where a user would never see it, keeping the script internally consistent.
- **UC-D1-EC3: upgrade path from a version carrying the old banner.** A developer who already has the harness installed at an older version and re-runs the updated `install.sh` sees the corrected banner on this run, with no special-cased "you already saw the old banner" logic — the fix is stateless with respect to prior runs.
- **UC-D1-EC4: this fix goes through the full pipeline, not a standalone doc edit (FR-1.6).** Because `install.sh` matches the fixed sensitive-path list, this use case's implementation is not eligible for a `fast`/`quick`-tier edit even though the change is "messaging only" — it is documented, use-cased, architecture-reviewed, QA-planned, and sliced like every other sensitive-path change in this feature.

### Data Requirements
- **Input**: CLI flags (`--init-project`, `--yes`, `--local`, `--no-plugin`, `--scope project` via `claude`); `claude`'s presence on `PATH`; `claude plugin list`/`marketplace list` output
- **Output**: console messaging only for this fix's scope; `.sdlc-receipt`, copied files, and exit codes are unaffected by this fix (they are affected by `install.sh`'s pre-existing, unmodified logic)
- **Side Effects**: none new — no new file written, no new flag behavior; the only observable delta is printed text

---

## Group E (FR-2): `.gitignore` — `.claude/debug/`

**Actor**: Developer / CI (passive observers); `debugger` agent (the writer of the directory this entry ignores)
**Preconditions**: A git-tracked checkout of this repository.
**Trigger**: `git status` (or any git operation that walks the working tree) after `.claude/debug/` has been written to by the `debugger` agent or by `subagent:stop:wave-record` (Group B's `.claude/debug/wave-results/`).

### UC-E1: `.claude/debug/` Ignored, Anchored Form (Primary Flow)

1. `.gitignore` gains the entry in the ANCHORED form `/.claude/debug/` — matching the `/.sdlc-model-profile` anchoring precedent already in the file, and required (not merely preferred) per FR-2.1 because an unanchored `.claude/debug/` pattern would shadow tracked fixture files (see UC-E1-A2).
2. A session runs `subagent:stop:wave-record`, writing `.claude/debug/wave-results/<safeId>.json`, or the `debugger` agent writes its own transient state under `.claude/debug/`.
3. `git status` is run in the same checkout.

**Postconditions**: the newly written file(s) under the repository-root `.claude/debug/` do not appear in `git status` output (AC-2's seeded "a file written under `.claude/debug/` no longer appears in `git status`" case).

### Alternative Flows
- **UC-E1-A1: `.claude/debug/` did not previously exist.** On a checkout where no session has ever written to `.claude/debug/`, adding the `.gitignore` entry has no observable effect until the directory is first created — this is a no-op state, not an error.
- **UC-E1-A2: anchored form does NOT shadow the three tracked debugger fixture files (corrected — the unanchored form was the wrong design).** `tests/fixtures/agents/debugger/*/.claude/debug/` contains three tracked fixture files (e.g. `tests/fixtures/agents/debugger/second-invocation-existing-log/.claude/debug/some-feature.md`) that the `debugger` agent's own test suite depends on being committed. An unanchored pattern `.claude/debug/` matches `.claude/debug/` at *any* depth in the tree, including under `tests/fixtures/agents/debugger/*/` — which would silently make `git status` treat those three already-tracked files as ignored-going-forward and mask any future accidental deletion or unintended modification from status output (git continues to track a file already committed, but an ignored, tracked file behaves surprisingly around `git add -A`, `git clean`, and tooling that consults ignore rules rather than the index). The ANCHORED form `/.claude/debug/` matches only a `.claude/debug/` directory whose parent is the repository root — it does not match `tests/fixtures/agents/debugger/*/.claude/debug/` at all, because that path does not start at the root. The negative case: after adding `/.claude/debug/`, `git ls-files tests/fixtures | grep '\.claude/debug'` still returns all three tracked fixture files (AC-2), and `git check-ignore <each fixture path>` reports no match (exits 1, "not ignored") for each of the three.

### Error / No-Widening Flows
- **UC-E1-E1: nothing previously tracked gets ignored accidentally — the core constraint of this fix.** `.claude/scratchpad.md` and `.claude/instincts.md` remain tracked exactly as today (FR-2.2). A repository state where either file is already committed and then a `git status` is run after the `.gitignore` change shows neither file as newly untracked or newly ignored — the new entry's anchored pattern (`/.claude/debug/`) does not match `.claude/scratchpad.md` or `.claude/instincts.md` by prefix, glob overlap, or depth. This is the seeded negative case in AC-2.
- **UC-E1-E2: any other existing tracked file under `.claude/` (e.g. `.claude/rules/*.md`, a project's `.claude/settings.json`) is unaffected.** The anchored entry is scoped to the literal, root-relative `.claude/debug/` path segment only — verified by confirming no other `.claude/*` tracked file's `git status`/`git ls-files` membership changes across this fix's commit.
- **UC-E1-E3: no code that writes to `.claude/debug/` is modified by this fix (FR-2.2 scope).** `subagent-stop-wave-record.js` and the `debugger` agent's own write paths are untouched — this use case's postcondition is entirely a `.gitignore`-file-content change; no handler behavior changes as a result.
- **UC-E1-E4: an unanchored pattern is a regression, not an acceptable alternative implementation.** A slice implementing FR-2 that writes `.claude/debug/` (no leading `/`) instead of `/.claude/debug/` fails AC-2's fixture-shadowing check even though it still achieves UC-E1's primary postcondition for the repository-root directory — the anchored form is a hard requirement (FR-2.1: "The pattern MUST be the ANCHORED form"), not a style preference, and code review / plan-critic must treat the unanchored form as a BLOCKER-tier finding given the concrete fixture-shadowing consequence named above.

### Edge Cases
- **UC-E1-EC1: a file already committed under `.claude/debug/` from before this fix (if any exists in history, outside the three known fixture files).** Adding a `.gitignore` entry never un-tracks an already-committed file — git continues to track a file it already knows about regardless of a later-added ignore pattern. If such a file exists, this fix's `.gitignore` entry alone does not remove it from tracking (a separate `git rm --cached` would be required, which is out of this fix's stated scope — FR-2 is `.gitignore`-only).
- **UC-E1-EC2: two gate agents previously flagged this as untracked noise (the motivating observation).** `docs/findings/live-pipeline-run-2026-08-20.md` §6 records `.claude/debug/` being flagged by two gate agents in the live run; this use case's postcondition (UC-E1) is the direct fix for that specific observed noise, verifiable by re-running the same class of gate check against a checkout with a populated `.claude/debug/` and confirming no flag is raised.
- **UC-E1-EC3: nested nesting depth beneath the anchored root directory is still covered.** `subagent:stop:wave-record` writes under `.claude/debug/wave-results/<safeId>.json` — one level deeper than the ignored directory itself. The anchored directory-pattern form `/.claude/debug/` still covers arbitrary nesting depth *beneath* the anchored root (gitignore directory patterns match the directory and everything under it, regardless of depth); the anchoring constrains only where in the tree the `.claude/debug/` directory itself may start (the repository root), not how deep files nested inside it may go.

### Data Requirements
- **Input**: none beyond the `.gitignore` file itself and the working tree's contents, including the three tracked fixture files under `tests/fixtures/agents/debugger/*/.claude/debug/`
- **Output**: `git status`/`git ls-files` output excludes anything under the repository-root `.claude/debug/`; `git ls-files tests/fixtures | grep '\.claude/debug'` continues to return the three fixture files; `git check-ignore` does not match them
- **Side Effects**: none — a pure `.gitignore`-content change; no file is moved, deleted, or newly created by this fix

---

## Group F (FR-6): Skill-Text Reconciliation

**Actor**: Developer/agent reading skill text (`skills/merge-ready/SKILL.md`, `skills/develop-feature/SKILL.md`); `validate-triage-parity`, `validate-instinct-discipline` (the CI validators whose protected/pinned regions must remain untouched, per NFR-3)
**Preconditions**: The four target sentences/sections exist in their current (stale) form, as quoted in PRD 13.3 FR-6.1–FR-6.5.
**Trigger**: This feature's implementation slices edit the four locations; downstream, any future `/merge-ready` or `/develop-feature` run reads the corrected text.

### UC-F1: `merge-ready` Finalization Changelog Step — Compose-Then-Orchestrator-Writes (FR-6.1)

1. `skills/merge-ready/SKILL.md`'s Finalization changelog step currently reads "Delegate the actual file write to the `doc-updater` agent."
2. This sentence is replaced with wording describing compose-then-orchestrator-writes: `doc-updater` composes the changelog entry text; the orchestrator performs the single `CHANGELOG.md` write under the existing idempotency guard.
3. This reconciles the skill text with `pre:agent:isolation-guard`'s measured, by-design refusal of subagent changelog writes (`docs/findings/live-pipeline-run-2026-08-20.md` §1) — the guard itself is not modified (per the Unchanged Files table, PRD 13.6).

**Postconditions**: `skills/merge-ready/SKILL.md` no longer contains the literal string "Delegate the actual file write to the `doc-updater` agent" (AC-6); a fresh `/merge-ready` run following the corrected text no longer hits a first-attempt `pre:agent:isolation-guard` refusal at this step, because the described flow now matches what the guard has always required.

### UC-F2: `merge-ready` Release Step — Names the Sanctioned Override (FR-6.2)

1. The release-push step's text is updated to state that the release push is performed with `SDLC_ALLOW_GIT_GUARD=1` as the sanctioned mechanism when following the project's declared release procedure.
2. This reconciles with `pre:bash:git-guard`'s measured refusal of the release push (`docs/findings/live-pipeline-run-2026-08-20.md` §7 — "Guard and release procedure disagree about whether a pipeline release push is 'requested.'") — the guard itself is not modified.

**Postconditions**: `skills/merge-ready/SKILL.md` states `SDLC_ALLOW_GIT_GUARD=1` as the sanctioned release-push mechanism (AC-6); a future release push following the corrected text spends the override deliberately rather than being surprised by the refusal and burning an undocumented Rule 3 retry.

### UC-F3: `develop-feature` Quick Tier Execution — Stale "Land in a Later Slice" Removed, Both Copies (FR-6.3)

1. `skills/develop-feature/SKILL.md`'s Quick Tier Execution section currently states the receiving ends (`planner`'s Quick-Tier Contract mode, `/implement-slice`'s tier-aware pre-flight bypass, `/merge-ready`'s reduced gate subset) "land in a later slice."
2. This sentence is removed — all three shipped in 4.4.0 (`docs/findings/live-pipeline-run-2026-08-20.md` §6).
3. `src/claude.md` (the memory-layer source `install.sh` copies into `~/.claude/CLAUDE.md`) carries the byte-identical stale sentence around line 77; it sits OUTSIDE `validate-triage-parity`'s protected block (which ends at "**Tier branch —"), so it is in scope and is corrected in the same slice — leaving it uncorrected would reintroduce the exact drift class this feature exists to close.

**Postconditions**: `skills/develop-feature/SKILL.md`'s Quick Tier Execution section no longer contains the "land in a later slice" sentence, and neither does `src/claude.md`'s copy of it — both asserted (AC-6).

### UC-F4: `develop-feature` Step 1a — `agent_type` Text Updated With Version-Scoped Fallback (FR-6.4)

1. The sentence "SubagentStop carries no agent_type (measured)" is updated to reflect 2.1.237 reality: `agent_type` is now measured present (Group B's FR-4).
2. An explicit version-scoped fallback is stated: on older CLIs where `agent_type` is absent, wave-record cross-checks fall back to mapping by `agent_id`, as they do today.

**Postconditions**: `develop-feature` step 1a no longer states "SubagentStop carries no agent_type" unqualified (AC-6); the corrected text names both the 2.1.237-present case and the older-CLI fallback.

### UC-F5: `develop-feature` Step 1a — Calibrated `tool_results_errored` Rule (FR-6.5)

1. The current absolute rule — "`tool_results_errored` is 0 before treating a slice as PASS" — is replaced with a calibrated rule: a nonzero count triggers a closer read (whether the slice's `Verify:` step is present among recorded `commands`; whether the record's final state is otherwise consistent with success), never an automatic FAIL.
2. This reconciles with the measured case in `docs/findings/live-pipeline-run-2026-08-20.md` §3 (`prd-writer`'s record showed `tool_results_errored: 2` on a slice that succeeded — transient, self-corrected `Edit` mismatches).

**Postconditions**: `develop-feature` step 1a states the calibrated rule (closer read on nonzero, never automatic FAIL) instead of the absolute "must be 0" rule (AC-6).

### Alternative Flows (across UC-F1–UC-F5)
- **UC-F-A1: a slice edits only one of the four locations at a time.** Because the four reconciliations are independent sentences/sections in two different files, an implementation slice may address them individually or in any grouping; no ordering dependency exists between UC-F1–UC-F5 the way FR-5 depends on FR-4 (PRD 13.10 Risk 1) — this group carries no analogous sequencing risk.
- **UC-F-A2: FR-6.4's wording is written to describe what Group B/C actually implement, not aspirational behavior.** Per PRD 13.10 Risk 3, FR-6.4 and FR-6.5's slices are sequenced after Group B (FR-4) and Group C (FR-5) land, so the corrected text describes shipped behavior rather than a promise.

### Error / Constraint Flows — Protected Regions Must Survive Untouched
- **UC-F-E1: `validate-triage-parity`'s protected region is untouched by FR-6.3–FR-6.5.** `validate-triage-parity` greps two copies of the Triage Phase 0 Steps 1-7 text (`develop-feature`'s own Phase 0 and its mirrored restatement in `CLAUDE.md`) for byte parity. UC-F3, UC-F4, and UC-F5's edits are scoped to Quick Tier Execution and Step 1a's `agent_type`/`tool_results_errored` text — both explicitly outside the protected Steps 1-7 region (NFR-3). A slice implementing this group runs `node scripts/ci/validate-triage-parity.js` after each edit to `skills/develop-feature/SKILL.md` and confirms it still passes unmodified; a failure here is a Rule 4 escalation (an edit strayed into the protected region), not a Rule 1/2 auto-fix.
- **UC-F-E2: `validate-instinct-discipline`'s pinned `merge-ready` clauses are untouched by FR-6.1–FR-6.2.** UC-F1 and UC-F2's edits are scoped to the Finalization changelog-delegation sentence and the Release step's override-naming sentence — neither is one of `validate-instinct-discipline`'s pinned clauses (the Consolidate Instincts / Cross-Session Learning ownership language). A slice implementing this group runs the validator after each edit to `skills/merge-ready/SKILL.md` and confirms it still passes unmodified.
- **UC-F-E3: an edit that accidentally widens scope beyond the four named sentences/sections.** If a slice's diff to either `SKILL.md` file touches lines outside the four locations FR-6.1–FR-6.5 name, this is flagged during code review / the plan-critic pass as an unjustified scope expansion in a sensitive, validator-pinned document — even though `skills/*.md` is not itself on the fixed sensitive-path list, the pinned-region constraint (NFR-3) makes over-broad edits to these two files specifically higher-risk than an arbitrary doc edit.

### Edge Cases
- **UC-F-EC1: a future `agent_type` re-measurement on a still-newer Claude Code build.** UC-F4's corrected text is scoped to "2.1.237 reality" with an explicit older-CLI fallback; it does not claim permanence — a later re-measurement finding, e.g., a further payload change would require its own follow-up reconciliation, out of this feature's scope.
- **UC-F-EC2: `skills/merge-ready/SKILL.md`'s other Finalization sub-steps (Consolidate Instincts, version bump) are unaffected.** UC-F1/UC-F2 touch only the changelog-delegation and release-push sentences; the Cross-Session Learning write-ownership rules and the version-bump sequencing text elsewhere in Finalization are untouched, verified by diffing the commit against the two named sentences only.

### Data Requirements
- **Input**: the current text of the four locations (`skills/merge-ready/SKILL.md` Finalization + Release; `skills/develop-feature/SKILL.md` Quick Tier Execution + Step 1a)
- **Output**: rewritten prose at exactly those four locations; `AC-6`'s grep-based non-presence/presence checks
- **Side Effects**: none — no runtime code touched; `validate-triage-parity` and `validate-instinct-discipline` re-run green after each edit (NFR-3)

---

## Cross-Cutting Use Case: NFR/AC Sweep (applies across all six groups)

### UC-X1: Full Validator/Test Sweep and Version Bump — Primary Flow

**Actor**: Developer / `build-runner` (during `/merge-ready`)
**Preconditions**: All six groups' slices have landed.
**Trigger**: The feature's final `/merge-ready` run, or a manual sweep.

1. `hooks/hooks.json`'s distinct hook-id count remains 12 — none of the six groups registers a new hook id or event matcher; each modifies an existing handler body, a skill's prose, `install.sh`, or `.gitignore` (NFR-1, AC-7).
2. `tests/hooks/test-guards-cross.js`'s handler-count assertion passes unmodified.
3. The version bump to `4.6.0` rides the first code-touching commit of this feature (NFR-2) — `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `install.sh`'s `VERSION="..."`, and `README.md`'s version badge all read `4.6.0` after that commit.
4. `node scripts/ci/validate-version-consistency.js` passes.
5. The full sweep — `for v in scripts/ci/validate-*.js; do node "$v" || exit 1; done` and `for t in tests/hooks/test-*.js; do node "$t" || exit 1; done` — passes (AC-7).
6. Any README/docs row describing behavior changed by any of the six groups is updated in the same feature (NFR-6) — no row is left describing pre-fix behavior.

**Postconditions**: `MERGE READY`, all gates green, hook-id count unchanged at 12, version `4.6.0` everywhere it is declared.

### Alternative Flow
- **UC-X1-A1: version bump lands before Group A's/B's/C's behavior code, per the tracer-bump sequencing pattern (NFR-2).** Consistent with the 4.5.0 precedent (`docs/findings/live-pipeline-run-2026-08-20.md` §6, "no validator was ever filtered"), the bump rides the first commit rather than the last, so every intermediate slice's unfiltered validator sweep sees a consistent, if bumped-but-unreleased, version — `validate-release-readiness`'s documented pre-release OK state.

### Error Flow
- **UC-X1-E1: FR-5 (Group C) implemented before FR-4 (Group B) ships — sequencing violation, must be caught before merge.** If slice ordering places Group C before Group B, `stop:gate-evidence` would read an `agent_type` field that does not yet exist in wave-records — PRD 13.10 Risk 1's named risk. Mitigation, verified as part of this use case: the implementation plan places Group B strictly before Group C, and `plan-critic`'s BLOCKER-tier review is expected to flag any plan that violates this ordering before implementation begins.

### Data Requirements
- **Input**: the full repository state after all six groups' slices
- **Output**: validator/test sweep exit codes; version strings in four files
- **Side Effects**: none beyond the four files' version-string edits and whatever each group's own slices already touch

---

## Traceability

| Use Case | PRD Requirements |
|---|---|
| UC-A1 (Primary) | FR-3.2, AC-3 |
| UC-A1-A1 | FR-3.3, AC-3 |
| UC-A1-A2 | FR-3.2 |
| UC-A1-A3 | FR-3.2 |
| UC-A1-E1 | FR-3.3, AC-3 |
| UC-A1-E2 | FR-3.4, AC-3 |
| UC-A1-E3 | FR-3.2, FR-3.3, FR-3.5(a) (no widening) |
| UC-A1-E4 | FR-3.6(a), NFR-5 |
| UC-A1-E5 | FR-3.6(b), NFR-5 |
| UC-A1-EC1 | FR-3.2 |
| UC-A1-EC2 | FR-3.2, NFR-5 |
| UC-A1-EC3 | FR-3.2 |
| UC-A1-EC4 | AC-3 (config-level assertion) |
| UC-A1-EC5 | FR-3.5(a), FR-3.5(b) |
| UC-B1 (Primary) | FR-4.1, FR-4.2, FR-4.4, AC-4 |
| UC-B1-A1 | FR-4.2, AC-4 |
| UC-B1-A2 | FR-4.3 |
| UC-B1-E1 | FR-4.2, NFR-5 |
| UC-B1-E2 | FR-4.2, NFR-5 |
| UC-B1-E3 | FR-4.2, NFR-5 |
| UC-B1-EC1 | FR-4.2, FR-4.4, AC-4 |
| UC-B1-EC2 | FR-4.2 |
| UC-B1-EC3 | FR-4.1 |
| UC-C1 (Primary) | FR-5.1, FR-5.2, FR-5.3, AC-5 |
| UC-C1-A1 | FR-5.2, FR-5.3, AC-5 |
| UC-C1-A2 | FR-5.5, AC-5 |
| UC-C1-A3 | FR-5.2 (no change to non-claim path) |
| UC-C1-E1 | FR-5.6, NFR-5 |
| UC-C1-E2 | FR-5.6, NFR-5 |
| UC-C1-E3 | FR-5.2, FR-5.4, NFR-5 |
| UC-C1-E4 | FR-5.2 |
| UC-C1-EC1 | FR-5.3 |
| UC-C1-EC2 | FR-4.2, FR-5.5 |
| UC-C1-EC3 | FR-5.3 |
| UC-C1-EC4 | FR-5.4, AC-5 |
| UC-C1-EC5 | FR-5.3 |
| UC-D1 (Primary) | FR-1.1, FR-1.3, FR-1.4, AC-1 |
| UC-D1-A1 | FR-1.2, FR-1.5, FR-1.7, AC-1 |
| UC-D1-A2 | FR-1.5, AC-1 |
| UC-D1-A3 | FR-1.4 (unaffected path) |
| UC-D1-A4 | FR-1.4 (unaffected path) |
| UC-D1-E1 | FR-1.4 (unaffected path) |
| UC-D1-E2 | FR-1.4 (unaffected path) |
| UC-D1-E3 | FR-1.4 (unaffected path) |
| UC-D1-EC1 | AC-1 |
| UC-D1-EC2 | FR-1.2 |
| UC-D1-EC3 | FR-1.1, FR-1.3 |
| UC-D1-EC4 | FR-1.6, FR-1.7 |
| UC-E1 (Primary) | FR-2.1 (anchored form), AC-2 |
| UC-E1-A1 | FR-2.1 |
| UC-E1-A2 | FR-2.1, AC-2 (fixture non-shadowing) |
| UC-E1-E1 | FR-2.2, AC-2 |
| UC-E1-E2 | FR-2.2 |
| UC-E1-E3 | FR-2.2 |
| UC-E1-E4 | FR-2.1 (hard requirement, not style) |
| UC-E1-EC1 | FR-2.1 (scope limit) |
| UC-E1-EC2 | AC-2 |
| UC-E1-EC3 | FR-2.1 (anchoring semantics) |
| UC-F1 | FR-6.1, AC-6 |
| UC-F2 | FR-6.2, AC-6 |
| UC-F3 | FR-6.3 (both `skills/develop-feature/SKILL.md` and `src/claude.md`), AC-6 |
| UC-F4 | FR-6.4, AC-6 |
| UC-F5 | FR-6.5, AC-6 |
| UC-F-A1 | (process — no direct FR) |
| UC-F-A2 | PRD 13.10 Risk 3 |
| UC-F-E1 | NFR-3 |
| UC-F-E2 | NFR-3 |
| UC-F-E3 | NFR-3 |
| UC-F-EC1 | FR-6.4 (scope limit) |
| UC-F-EC2 | (non-regression) |
| UC-X1 (Primary) | NFR-1, NFR-2, AC-7 |
| UC-X1-A1 | NFR-2 |
| UC-X1-E1 | PRD 13.10 Risk 1 |
