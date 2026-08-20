# Test Cases: Post-Live-Run Reconciliation

> Based on [PRD](../PRD.md) — Section 13 and [Use Cases](../use-cases/post-live-run-reconciliation_use_cases.md)

---

**System context:** this feature has no UI, no server, no database, and no HTTP boundary (PRD 13.7–13.9).
It is six independently-verifiable fixes across three hook handlers, one install script, one `.gitignore`
entry, and four skill-text locations. Every test case below is either (a) a Node hook-handler test
extending `tests/hooks/test-guard-read.js`, `tests/hooks/test-subagent-wave-record.js`, or
`tests/hooks/test-stop-gate-evidence.js`, using those files' existing `runHook`/`Checks`/`tempDir`
conventions from `tests/hooks/harness.js`; (b) a shell/grep assertion against `install.sh` or
`.gitignore`, runnable via `bash -n`, `grep`, and `git check-ignore`/`git ls-files`; (c) a text-presence
or text-absence assertion against the four skill-text locations; or (d) a validator-survival check
(`validate-triage-parity`, `validate-instinct-discipline`, the full `scripts/ci/validate-*.js` /
`tests/hooks/test-*.js` sweep). No test case in this document invokes an LLM or agent — all are STATIC
in the sense `self-improvement-loop_test_cases.md` defines the term.

**Per-group non-widening discipline (NFR-5, applies throughout):** every Group A/B/C test case that
exercises an error or fail-open path MUST assert TWO things together: (1) the mechanism did not throw
and did not newly block/refuse, and (2) where a "before" fixture exists, the output is byte-identical to
pre-fix behavior for that fixture. A test asserting only "no throw" without the byte-identical comparison
is insufficient for any scenario explicitly named "byte-identical" or "unchanged" in the use cases.

**Traceability convention:** the "UC Scenario" column below names the exact PRD FR/AC and use-case ID(s)
each test case covers, mirroring `stale-install-detection_test_cases.md`'s convention. A consolidated
Traceability table appears at the end confirming every UC scenario in
`docs/use-cases/post-live-run-reconciliation_use_cases.md` maps to at least one TC ID here.

---

## 1. Reference Fixtures (used across multiple test cases below)

Not a test itself — shared fixture shapes referenced by ID.

- **FIX-hooks-pre:** a copy of `hooks/hooks.json` as it exists BEFORE FR-3.2 ships (matcher `"Read"` only for id `pre:edit:read-guard`'s `PostToolUse` registration) — used only in TC-A2/TC-A18 to prove the config-level assertion actually distinguishes fixed from broken.
- **FIX-wave-full:** four wave-record files under `.claude/debug/wave-results/`, one per allowlist `agent_type` (`code-reviewer`, `security-auditor`, `build-runner`, `verifier`), each also carrying a bound-passing `agent_id` AND `session_id: 's1'` — matching `stop()`'s hardcoded `session_id: 's1'` in `test-stop-gate-evidence.js`, since a record's `agent_type` can only reach the "observed" side of `systemMessage` when its `session_id` matches the `Stop` payload's (FR-5.3's session filter).
- **FIX-wave-partial:** two of the four allowlist records present (each with `session_id: 's1'`), two absent.
- **FIX-wave-none:** wave-records present but none carry an `agent_type` key (simulating older-CLI or pre-fix records).
- **FIX-transcript-verdict-subagent:** a transcript whose final turn claims `MERGE READY` and whose `isSidechain` scan yields `sawSubagent === true` — the sole path `systemMessage` may ever attach to.
- **FIX-transcript-no-subagent:** a transcript claiming `MERGE READY` with `sawSubagent === false` — the sole existing blocking condition.
- **FIX-gitignore-anchored:** `.gitignore` with `/.claude/debug/` (post-fix, anchored).
- **FIX-gitignore-separator-free:** a temporary `excludesFile` (NOT the repo's own `.gitignore`) seeded with the separator-free pattern `debug/` (no path segment before it) — measured (2.1.237-era `git`) to be the only pattern shape that matches `.claude/debug/` at arbitrary depth, including under `tests/fixtures/agents/debugger/*/.claude/debug/`. Used only as the real-shadowing demonstration in TC-E8; never applied to the actual repository `.gitignore`.

---

## 2. Group A (FR-3): `pre:edit:read-guard` — Write-then-Edit, extends `tests/hooks/test-guard-read.js`

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-A1 | UC-A1 (Primary), FR-3.2, AC-3 | Write then Edit, no intervening Read, passes | `hooks/hooks.json`'s `PostToolUse` matcher for `pre:edit:read-guard` is `"Read\|Write"`; a project with an existing file | `record()` a `PostToolUse` `Write` event for the file; `gate()` a `PreToolUse` `Edit` for the same file, same session | `gate()` returns allow (`!denied(r)`); the freshness record's evidence line reflects the `Write` event |
| TC-A2 | UC-A1 (Primary), UC-A1-EC4, AC-3 (config-level, REQUIRED) | Config-level assertion: `hooks/hooks.json`'s `PostToolUse` registration carrying id `pre:edit:read-guard` has a matcher matching `Write` | Parse `hooks/hooks.json` directly (no handler invocation) | Read and `JSON.parse` `hooks/hooks.json`; locate the `PostToolUse` entry with `id === 'pre:edit:read-guard'` | `entry.matcher` matches `Write` (e.g. equals `"Read\|Write"` or a regex-equivalent pattern including `Write`) — this assertion MUST run independent of any behavior-level test, since behavior tests invoke the handler directly and bypass matcher routing |
| TC-A3 | UC-A1-A1, FR-3.3, AC-3 | Read-then-Edit — unchanged (non-regression, existing test retained verbatim) | Existing `record()`/`gate()` sequence from `test-guard-read.js` line 51–53 | Run unmodified | Passes exactly as before this feature |
| TC-A4 | UC-A1-A2, FR-3.2 | Write, then a second Write, then Edit — still passes | Same file | `record()` a `Write`, `record()` a second `Write`, `gate()` an `Edit` | Allowed; the guard does not require the most recent event to be any specific type |
| TC-A5 | UC-A1-A3, FR-3.2 | Read, then Write, then Edit — mixed evidence, still passes | Same file | `record()` a `Read` `PostToolUse`, then `record()` a `Write` `PostToolUse`, then `gate()` an `Edit` | Allowed; evidence from different event types is additive |
| TC-A6 | UC-A1-E1, FR-3.3, AC-3 | Edit with neither Read nor Write recorded — still refused (existing test retained) | Fresh session, no prior `record()` call | `gate()` an `Edit` | Denied; reason contains the remedy text and `[deviation: rule-1` tag, unchanged |
| TC-A7 | UC-A1-E2, FR-3.4, AC-3 | Override env var with the fix in place — byte-identical bypass semantics | No freshness evidence recorded | `gate()` with `SDLC_ALLOW_UNREAD_EDIT: '1'` | Allowed; `systemMessage` contains `'bypassed'`, byte-identical text to the pre-fix override test in `test-guard-read.js` line 108–110 |
| TC-A8 | UC-A1-E3, FR-3.2, FR-3.3, FR-3.5(a) | A Write denied by another guard (never executes) does NOT count as freshness — structural: no `PostToolUse` fires for a call that never ran | A file with no prior evidence | `gate()` an `Edit` directly, WITHOUT calling `record()` first (simulating that the upstream `Write`'s `PreToolUse` refusal meant no `PostToolUse` ever fired) | Denied, identical to TC-A6 — proves the widened matcher cannot manufacture freshness for a tool call that never executed, since the test harness never emits a `PostToolUse` event for it |
| TC-A9 | UC-A1-E4, FR-3.6(a), NFR-5 | An errored Write with a detectable error indication in `tool_response` does NOT mint freshness | `record()` invoked with a `tool_response` payload carrying a detectable error indication (e.g. `{ error: true }` or an equivalent shape the handler recognizes) for a `Write` event | `record()` the errored `Write`; `gate()` an `Edit` for the same file with no other evidence | Denied — the errored `Write` did not create freshness, identical outcome to TC-A6 |
| TC-A10 | UC-A1-E4, FR-3.6(a), NFR-5 | An errored Write with an AMBIGUOUS or ABSENT error-indicator shape fails OPEN to recording | `record()` invoked with a `tool_response` shape the handler cannot classify as erroring (or no `tool_response` at all) for a `Write` event | `record()`; `gate()` an `Edit` for the same file | Allowed — an undetectable error must not become a spurious refusal, per FR-3.6(a)'s explicit asymmetry |
| TC-A11 | UC-A1-E5, FR-3.6(b), NFR-5 | `tool_name` absent from the `PostToolUse` payload defaults to RECORDING, not skipping | A `PostToolUse` payload built with `tool_name` omitted entirely | Invoke the handler's `PostToolUse` half directly with `tool_name` absent, target a file; `gate()` an `Edit` for that file | Allowed — the handler recorded despite the unrecognized/absent `tool_name`, per FR-3.6(b)'s explicit permissive default |
| TC-A12 | UC-A1-EC1, FR-3.2 | Write then Edit spanning a simulated compaction boundary | `record()` and `gate()` invoked as two entirely separate `runHook` process calls (no shared in-memory state), proving the on-disk record — not model memory — is authoritative | `record()` a `Write`; (simulate compaction — no operation needed since state is already file-backed); `gate()` an `Edit` | Allowed — the on-disk freshness record persists across the simulated boundary |
| TC-A13 | UC-A1-EC2, FR-3.2, NFR-5 | Garbage-collected freshness record (session file missing/stale) — allow, not deny (`'unknown'`, not `'no'`) | Freshness record file removed/never created after a `Write` was recorded in a prior, now-vanished session file | `gate()` an `Edit` for a file with no locatable record | Allowed — unchanged from today's `Read`-based `'unknown'` handling; not the same code path as TC-A6's `'no'` |
| TC-A14 | UC-A1-EC3, FR-3.2 | Write to a `notebook_path` (Jupyter) target — resolution identical regardless of which field supplied the target | `record()` a `PostToolUse` `Write` with `tool_input: { notebook_path: <target> }` (no `file_path`) | `record()`; `gate()` an `Edit` against the same resolved `notebook_path` target | Allowed — the freshness tracker keys on resolved `target`, not the field name |
| TC-A15 | UC-A1-EC5(a), FR-3.5(a) | Forbidden mechanism (a) is not what shipped: freshness is never recorded at `PreToolUse` time inside the read-guard itself | Source inspection of `hooks/handlers/pre-edit-read-guard.js` | Grep the handler source for any freshness-recording call reachable from the `PreToolUse` branch | No freshness-recording call exists in the `PreToolUse` code path — recording occurs only from the `PostToolUse` branch |
| TC-A16 | UC-A1-EC5(b), FR-3.5(b) | Forbidden mechanism (b) is not what shipped: no cross-hook coupling with `post:edit:accumulate` to seed freshness | Source inspection of `hooks/handlers/pre-edit-read-guard.js` and `hooks/handlers/post-edit-accumulate.js` (or equivalent id) | Grep both handler files for any shared call/import between the read-tracker's `recordRead`-equivalent and the accumulator | No import/coupling exists; `pre:edit:read-guard`'s recorder is the only writer of the freshness record |
| TC-A17 | UC-A1 (Primary), non-regression | The guard's kill switch still disables BOTH halves post-fix, since they share one id | `SDLC_DISABLED_HOOKS: 'pre:edit:read-guard'` | `record()` a `Write` with the kill switch set; then `gate()` an `Edit` without the kill switch | The `Write` was never recorded while disabled (`gate()` still denies), reproducing `test-guard-read.js` lines 112–120 unmodified with a `Write` event substituted for a `Read` |
| TC-A18 | UC-A1-EC4, AC-3 (negative control for TC-A2) | The config-level assertion actually distinguishes the broken (pre-fix) matcher from the fixed one | FIX-hooks-pre (matcher `"Read"` only) as a synthetic fixture, separate from the live `hooks/hooks.json` | Run TC-A2's assertion logic against FIX-hooks-pre | The assertion FAILS against FIX-hooks-pre (matcher does not match `Write`) — proving TC-A2 is a real check, not a tautology |

---

## 3. Group B (FR-4): `subagent:stop:wave-record` — `agent_type`, extends `tests/hooks/test-subagent-wave-record.js`

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-B1 | UC-B1 (Primary), FR-4.1, FR-4.2, FR-4.4, AC-4 | `agent_type: "code-reviewer"` in the payload is recorded; `agent_id` in the record body is bounded by the same regex | A `SubagentStop` payload carrying `agent_type: "code-reviewer"` and a bound-passing `agent_id` | `record()` with `agent_type` added to the payload; read the resulting JSON | `agent_type: "code-reviewer"` present in the record; `agent_id` present and passes `/^[A-Za-z0-9:_-]{1,64}$/`; all pre-existing fields (`commands`, `files_written`, `tool_counts`, `tool_results_errored`, `final_text`) unchanged in shape/content vs. a payload without `agent_type` |
| TC-B2 | UC-B1 (Primary), non-regression | The existing 6 numbered blocks in `test-subagent-wave-record.js` (passing slice, contradicting self-report, truncated transcript, never-blocks, fail-open on absent/missing transcript, sanitized `agent_id` filename) remain green after this fix | Existing test file, unmodified sections 1–6 | Run the full file | All 6 existing blocks pass unmodified |
| TC-B3 | UC-B1-A1, FR-4.2, AC-4 | `agent_type` absent (older CLI) — record written, key OMITTED, never `null`, no throw | Payload with no `agent_type` field | `record()`; read the resulting JSON; also inspect the raw written bytes | `'agent_type' in rec === false` (not merely `rec.agent_type === undefined` from a lenient JSON round-trip — assert the raw JSON text contains no `"agent_type"` key at all); all other fields unchanged |
| TC-B4 | UC-B1-A2, FR-4.3 | Existing on-disk records are never touched by this fix | A pre-existing wave-record file (written before this feature, no `agent_type` field) with a fixed mtime/content snapshot | `record()` a NEW `SubagentStop` event for a different `agent_id` in the same directory | The pre-existing file's content and mtime are byte-identical to before — no migration, no rewrite |
| TC-B5 | UC-B1-E1, FR-4.2, NFR-5 | `agent_transcript_path` missing or non-string — unchanged early return | Payload with `agent_transcript_path: undefined` | `record(null, ...)` | Exits 0, no record file written, identical to pre-fix behavior (existing test section 5 retained) |
| TC-B6 | UC-B1-E2, FR-4.2, NFR-5 | Transcript unreadable, oversized, or malformed — unchanged fail-open, independent of `agent_type` presence | Nonexistent transcript path, WITH `agent_type` also present in the payload | `record()` with both an invalid transcript path and `agent_type: "code-reviewer"` in the payload | Exits 0, no record written — proves the early-return path is unaffected by `agent_type`'s presence |
| TC-B7 | UC-B1-E3, FR-4.2, NFR-5 | `.claude/debug/wave-results/` unwritable — caught by the existing top-level try/catch, `SubagentStop` never blocked | Directory made unwritable (mode `0o000`) or replaced with a file | `record()` a valid payload with `agent_type` present | Exits 0; no thrown exception; no `continue:false`, no `additionalContext` injected (mirrors existing section 4's never-blocks assertion) |
| TC-B8 | UC-B1-EC1(1–2), FR-4.2, FR-4.4, AC-4 | Hostile/invalid `agent_type` values (empty string beyond EC2's own case, >64 chars, embedded newline/backtick/control byte, non-string) are OMITTED, never coerced or truncated | Four payload variants: `agent_type` = 65-char string, string with `` ` `` and `\n`, a number, and an array | `record()` each variant | In every case, the record's raw JSON contains no `"agent_type"` key — never a truncated fragment, never coerced |
| TC-B9 | UC-B1-EC1(3), FR-4.4, AC-4 | `agent_id`'s record-body field is bounded the same way, but FALLS BACK to `safeId` on failure — never omitted | Two variants: (a) `agent_id` matching the bound; (b) `agent_id` containing hostile characters (e.g. `` `#!@`` `) that fail the bound | `record()` each variant | (a) record body's `agent_id` equals the raw value; (b) record body's `agent_id` equals the already-computed `safeId` (filename-derived form) — the key is always present, never omitted, unlike `agent_type`'s omit-on-failure |
| TC-B10 | UC-B1-EC1(4), FR-4.2, FR-4.4 | Neither `agent_type` nor `agent_id` is ever used in path construction beyond `safeId` | `agent_id` containing a traversal shape (`../../escaped`), `agent_type` containing a traversal-shaped string | `record()` with both fields hostile | Exactly one record file is written, inside `wave-results/`, named via the existing `safeId` derivation; no file appears outside the directory (extends existing section 6's traversal test with `agent_type` added) |
| TC-B11 | UC-B1-A1 (omission family), FR-4.2 | `agent_type` present but an empty string fails the bound `/^[A-Za-z0-9:_-]{1,64}$/` exactly like any other failing value — key OMITTED, not recorded as empty | Payload with `agent_type: ""` | `record()`; read the raw written file text (not just the parsed object) | Record is written normally (exit 0, no throw); the raw JSON text contains no `"agent_type"` substring at all — the empty string is rejected by the bound the same as any other failing value, with no empty-string carve-out, since a recorded empty agent type serves no consumer |
| TC-B12 | UC-B1-EC3, FR-4.1 | Concurrent subagents in the same wave write distinct records, no races | Two `record()` calls with distinct `agent_id`s and distinct `agent_type`s in the same `cwd`, issued back-to-back | Invoke both; read both resulting files | Two independent files exist, each with its own correct `agent_type`/`agent_id`; neither overwrote the other |
| TC-B13 | FR-4 (session_id capture, measured 2.1.237) | `session_id` is bounded `/^[A-Za-z0-9-]{1,64}$/` the same way as `agent_type`/`agent_id`: valid → recorded; invalid/absent → key OMITTED, record still written, no throw | Two variants: (a) `SubagentStop` payload carrying a well-formed UUID-shaped `session_id`; (b) payload with `session_id` absent, or hostile (embedded newline/markdown, >64 chars, or a non-string) | `record()` each variant; read the raw written file text | (a) record contains `"session_id":"<the UUID>"`; (b) raw JSON text contains no `"session_id"` substring at all — omitted, never `null`; exit 0 in both, all other pre-existing fields unaffected |
| TC-B14 | UC-B1-E-family (FR-4.4 hardening — non-string `agent_id`, not covered by TC-B8's agent_type-only cases or TC-B9's hostile-STRING `agent_id` case) | `agent_id` is a NON-STRING value (e.g. the number `42`) — the record is still written, at the `unknown.json` filename, with the record body's `agent_id` falling back to `'unknown'` | `SubagentStop` payload with `agent_id: 42` (a number, not a string) | `record()` with `agent_id: 42` in the payload; inspect both the written filename and the record body | Exits 0, no throw; the file is written as `unknown.json` (the pre-existing `safeId` default for a non-string/unusable `agent_id`); the record body's `agent_id` field equals `'unknown'` — the same fallback-not-omit behavior FR-4.4 specifies for a bound-failing string `agent_id`, extended here to a non-string type |

---

## 4. Group C (FR-5): `stop:gate-evidence` — Advisory Attribution, extends `tests/hooks/test-stop-gate-evidence.js`

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-C1 | UC-C1 (Primary), FR-5.1, FR-5.2, FR-5.3, AC-5 | Verdict + `sawSubagent === true`, all four allowlist wave-records present — allow, with `systemMessage` naming all four | FIX-transcript-verdict-subagent; FIX-wave-full seeded under `.claude/debug/wave-results/` | `stop()` the transcript | Allowed (`!blocked(r)`); `r.json.systemMessage` names all four allowlist types as observed, e.g. `"gate evidence observed: code-reviewer, security-auditor, build-runner, verifier"` |
| TC-C2 | UC-C1-A1, FR-5.2, FR-5.3, AC-5 | Some allowlist types missing from wave-records — `systemMessage` names the gap, decision unchanged | FIX-transcript-verdict-subagent; FIX-wave-partial (2 of 4 present) | `stop()` | Allowed (decision governed solely by `sawSubagent`, unaffected by which types were recorded); `systemMessage` names both observed and not-observed sets among the four |
| TC-C3 | UC-C1-A2, FR-5.5, AC-5 | `agent_type` absent on ALL wave-records — graceful degradation, decision unchanged | FIX-transcript-verdict-subagent; FIX-wave-none | `stop()` | Allowed, byte-identical decision to TC-C1/TC-C2; `systemMessage` (if present) names all four as not-observed; NEVER changes the allow outcome |
| TC-C4 | UC-C1-A3, FR-5.2 | Non-`MERGE READY` response — untouched, no enrichment attempted at all | A transcript with no verdict claim (reuse `test-stop-gate-evidence.js`'s existing "discussing the pipeline" fixture) | `stop()` | `!blocked(r)`; `r.json` carries no `systemMessage` (the function returns before enrichment logic runs) |
| TC-C5 | UC-C1-E1, FR-5.6, NFR-5 | Wave-record files unreadable/absent/malformed, or `pathIsSafe`+the handler's own `lstat` check refuses the directory — enrichment skipped, decision unaffected | FIX-transcript-verdict-subagent; `.claude/debug/wave-results/` absent, OR containing malformed JSON, OR replaced with a non-directory file | `stop()` for each variant | Allowed in every variant (decision was never sourced from wave-records); no `systemMessage`, or a `systemMessage` noting nothing could be read — either acceptable per FR-5.6, but the decision itself never differs from TC-C1's allow outcome given the same transcript |
| TC-C6 | UC-C1-E2, FR-5.6 | Transcript itself unreadable — returns null immediately, no enrichment attempted | Nonexistent transcript path | `stop()` a path to a file that does not exist | `!blocked(r)`, `r.code === 0` — reproduces existing "an unreadable transcript does not block" test unmodified |
| TC-C7 | UC-C1-E3, FR-5.2, FR-5.4, NFR-5, AC-5 | Zero subagents ran at all, verdict claimed — STILL BLOCKS, the one unchanged blocking condition, unaffected by enrichment machinery | FIX-transcript-no-subagent; wave-results EMPTY, PARTIAL, and FULL (three variants) | `stop()` for each of the three wave-record variants | Blocked in all three variants, with the SAME deny reason text and `SDLC_ALLOW_UNEVIDENCED_GATES` escape hatch named — proving enrichment (which only ever runs on the allow path) plays no role in this decision regardless of what wave-records exist |
| TC-C8 | UC-C1-E4, FR-5.2 | `SDLC_ALLOW_UNEVIDENCED_GATES=1` — unchanged escape, no `systemMessage` attempted on this short-circuit | FIX-transcript-no-subagent | `stop()` with `SDLC_ALLOW_UNEVIDENCED_GATES: '1'` | Allowed; no `systemMessage` present (the short-circuit returns before any transcript read or enrichment) |
| TC-C9 | UC-C1-EC1, FR-5.3 | `agent_type` present but NOT on the fixed allowlist (e.g. `"general-purpose"`) — contributes to neither observed nor not-observed | FIX-transcript-verdict-subagent; one wave-record with `agent_type: "general-purpose"`, no allowlist-matching records | `stop()` | Allowed; `systemMessage` (if built) never lists `"general-purpose"` under either observed or not-observed — it is out-of-vocabulary, silently ignored for message purposes |
| TC-C10 | UC-C1-EC2, FR-4.2, FR-5.5 | A record with no `agent_type` key (per Group B's omit-on-failure) is treated identically to "not observed," never a false match | Wave-record with `agent_type` key entirely absent | `stop()` | Treated identically to TC-C3's degradation case — contributes to "not observed," never a false attribution |
| TC-C11 | UC-C1-EC3, FR-5.3 | Duplicate/replayed wave-record files for the same `agent_type` — deduplicated `systemMessage`, each name appears at most once | Two wave-record files both carrying `agent_type: "code-reviewer"` and `session_id: 's1'` (simulating an interrupted-then-retried run, matching `stop()`'s session so both reach the observed side) | `stop()` with `session_id: 's1'` | `systemMessage` names `code-reviewer` exactly once, not twice; decision unaffected |
| TC-C12 | UC-C1-EC4, FR-5.4, AC-5 | Decision behavior is BYTE-IDENTICAL before and after this upgrade, re-run across ALL existing fixtures in `test-stop-gate-evidence.js` | Every existing transcript fixture already in the file (verdict-no-subagent, verdict-with-subagent, tool-only-subagent, NOT-MERGE-READY variants, unreadable transcript, truncated line, escape switch, kill switch, empty session) — none seeded with any wave-records | Run the full pre-existing suite unmodified against the upgraded handler | Every existing assertion (`blocked`/`!blocked`, `reason()` text) passes byte-identical to its pre-upgrade result |
| TC-C13 | UC-C1-EC5, FR-5.3 | 64-file / 64KB-per-file bound is exceeded — bounded partial read, never throws, never reads unbounded | 70 wave-record files under `.claude/debug/wave-results/`, each carrying `session_id: 's1'` (matching `stop()`'s session so the bound, not the session filter, is what limits observed count), and separately one file padded past 64KB | `stop()` with `session_id: 's1'` against the oversized directory | No throw; scan reads at most 64 files, each capped at 64KB; `systemMessage` reflects only the bounded partial read (a subset of allowlist types may be under-observed) — never blocks and never hangs |
| TC-C14 | FR-5.3 (hostile content never leaks) | Hostile/markdown-laden `agent_type`/`agent_id` values in wave-records never appear in `systemMessage` or the deny reason — only fixed allowlist names ever appear | A wave-record with `agent_type: "code-reviewer"` (valid, matches allowlist), `session_id: 's1'` (matching `stop()`'s session so this record reaches the observed side), and `agent_id` containing a 5,000-char hostile string with markdown headers and backticks | `stop()` with `session_id: 's1'`; grep the full `r.json.systemMessage` and `r.json.reason` for the hostile marker string | Zero matches for the hostile content in either field — only the fixed allowlist name `code-reviewer` appears |
| TC-C15 | FR-5.3 (own `lstat` check, symlink refusal) | A symlinked `wave-results` file (or the directory itself) is refused via the handler's own `lstat`-based check, since `pathIsSafe` alone does not validate this subpath | `.claude/debug/wave-results/code-reviewer.json` (would otherwise carry `session_id: 's1'`) replaced with a symlink to a file outside the directory | `stop()` against FIX-transcript-verdict-subagent | The symlinked file is skipped/refused, not read; no content from the symlink target ever reaches `systemMessage`; decision unaffected; no throw |
| TC-C16 | FR-5.3 (fixed allowlist only, no record-derived text) | No record-derived text is EVER interpolated into `systemMessage` or the deny reason — confirmed via the fixed allowlist names only | FIX-wave-full (each record already carrying `session_id: 's1'`, matching `stop()`'s session), with each record ALSO carrying an unrecognized extra field (`notes: "should never appear"`) | `stop()` with `session_id: 's1'`; grep the full output for `"should never appear"` | Zero matches — only `code-reviewer`, `security-auditor`, `build-runner`, `verifier` (the fixed allowlist strings) ever appear in emitted text |
| TC-C17 | FR-5.3 (session_id filter, measured: Stop and SubagentStop share one UUID per session) | A wave-record whose `session_id` does NOT match the `Stop` payload's `session_id` — its `agent_type` appears on NEITHER side of the `systemMessage` | FIX-transcript-verdict-subagent, `stop()`'d with `session_id: 's1'`; one wave-record with `agent_type: "code-reviewer"` but `session_id: 's-other'` (a different session, e.g. left over from a prior run) | `stop()` with `session_id: 's1'` | `code-reviewer` appears in neither the "observed" nor the "not observed" list — a cross-session record is excluded from attribution entirely, not merely treated as absent |
| TC-C18 | FR-5.3 (no session_id — pre-feature or older-CLI record) | A wave-record with no `session_id` field at all (e.g. written before this feature shipped) is excluded from "observed"; the "not observed" side is computed as the full allowlist complement, unaffected by the excluded record | FIX-transcript-verdict-subagent, `stop()`'d with `session_id: 's1'`; one wave-record with `agent_type: "code-reviewer"` and no `session_id` key at all; no other records present | `stop()` with `session_id: 's1'` | `code-reviewer` is NOT listed as observed (the record was excluded for lacking `session_id`); the `systemMessage`'s not-observed side names all four allowlist types (`code-reviewer` included), since zero same-session records were matched |
| TC-C19 | FR-5.3 (zero same-session records) | Wave-results directory contains records, but NONE share the `Stop` payload's `session_id` — decision unchanged, all four allowlist names fall to "not observed" | FIX-transcript-verdict-subagent, `stop()`'d with `session_id: 's1'`; FIX-wave-full seeded but every record's `session_id` set to `'s-other'` | `stop()` with `session_id: 's1'` | Allowed (decision governed solely by `sawSubagent`, unaffected by session_id filtering); `systemMessage` names all four allowlist types as not-observed, none as observed |

---

## 5. Group D (FR-1): `install.sh` De-Obsolescence

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-D1 | UC-D1 (Primary), UC-D1-EC1, AC-1 | Whole-file grep: no "ONE STEP LEFT — required, per project" banner text anywhere in `install.sh`, including comments | Post-fix `install.sh` | `grep -F "ONE STEP LEFT — required, per project" install.sh` | Zero matches |
| TC-D2 | UC-D1 (Primary), AC-1 | Whole-file grep: no "required" near "project" install-step claim anywhere in the file (widened from `--init-project`-only) | Post-fix `install.sh` | `grep -inE 'required.{0,40}project|project.{0,40}required' install.sh`, then manually confirm any surviving match is line 206's unrelated "Both parts are required" claim | Zero matches OTHER than the explicitly out-of-scope line 206 text |
| TC-D3 | UC-D1 (Primary), FR-1.3, AC-1 | Replacement guidance text present, naming the exact verification steps | Post-fix `install.sh` | `grep -F "claude plugin list" install.sh`; `grep -F "Scope: user" install.sh`; `grep -F "enabled" install.sh` (near the plugin-list guidance) | All three present in the banner's replacement text |
| TC-D4 | UC-D1 (Primary), FR-1.4 | `bash -n install.sh` syntax check passes post-edit | Post-fix `install.sh` | `bash -n install.sh` | Exit code 0 |
| TC-D5 | UC-D1-A1, FR-1.2, FR-1.5, FR-1.7, AC-1 | `--init-project`'s `INIT_PROJECT` branch no longer frames the per-project step as generally required | Post-fix `install.sh`, lines 1631–1636 | `grep -A6 -n 'INIT_PROJECT' install.sh` (or targeted line-range read) around 1631–1636 | Text no longer states the per-project step is required in general; `enable_plugin_for_project()` (measured span: lines 1463–1474 — located by content, i.e. the function's own `enable_plugin_for_project()` definition and body, not the stale 1467–1472 estimate) still runs and installs at project scope, unmodified |
| TC-D6 | UC-D1-A2, FR-1.5, AC-1 | `--scope project` continues to work unmodified | A test/mocked `claude` CLI on `PATH` | Run `install.sh` (or the isolated `claude plugin install claude-code-sdlc@claude-code-sdlc --scope project` command the banner names) in a scripted/mocked environment | Completes and installs at project scope, per AC-1's explicit requirement that this capability "still complete[s] and install[s] at project scope when invoked" |
| TC-D7 | UC-D1-A3, FR-1.4 (unaffected path) | `claude` not on `PATH` — existing fail-open branch unchanged | `PATH` without `claude` | Run `install_plugin()`'s logic (or `install.sh` directly) with `claude` absent | Memory layer installs; two manual commands are printed, unchanged from pre-fix behavior — this path is untouched by FR-1's messaging scope |
| TC-D8 | UC-D1-A4, FR-1.4 (unaffected path) | `--no-plugin` — `print_next_step()` still short-circuits, prints nothing | `install.sh --no-plugin`, non-interactive | Run with `--no-plugin --yes` | No banner text of any kind printed — the `NO_PLUGIN` guard clause itself is untouched by this fix |
| TC-D9 | UC-D1-E1, FR-1.4 (unaffected path) | Non-interactive without `--yes`, no `/dev/tty` — existing refusal message unchanged | Non-interactive shell, no `--yes` | Run `install.sh` with no `--yes` and no tty | Existing "No terminal available for confirmation ... Re-run non-interactively with --yes" message, byte-identical to pre-fix |
| TC-D10 | UC-D1-E2, FR-1.4 (unaffected path) | Marketplace-add failure fallback instructions unchanged | Simulated marketplace-add failure (mocked `claude plugin marketplace list` returning no match) | Run `install_plugin()`'s logic against the simulated failure | `log_warn` fallback instructions byte-identical to pre-fix |
| TC-D11 | UC-D1-E3, FR-1.4 (unaffected path) | `--dry-run` combined with `--init-project` or a plain install is unaffected | `install.sh --dry-run --init-project` and `install.sh --dry-run` | Run both | Neither reaches `print_next_step()`'s live text or `enable_plugin_for_project()`'s live execution; dry-run reporting mechanism itself is unchanged |
| TC-D12 | UC-D1-EC1, AC-1 | Grep verification is text-based and complete — covered by TC-D1; explicit cross-reference | See TC-D1 | See TC-D1 | See TC-D1 (this row exists to make the UC-EC1 mapping explicit in the traceability table) |
| TC-D13 | UC-D1-EC2, FR-1.2 | Header/rationale comments referencing the per-project step (lines 1445–1451) are reconciled, not merely left stale in a place the user never sees | Post-fix `install.sh`, lines 1445–1451 | Read lines 1445–1451 directly | The comment block no longer states or implies "required on Claude Code 2.1.x" for the per-project step; line 1452 (see TC-D15) is untouched |
| TC-D14 | UC-D1-EC3, FR-1.1, FR-1.3 | Stateless with respect to prior runs — no "you already saw the old banner" special-casing | Post-fix `install.sh` | Grep for any state-tracking logic (env var, marker file) gating which banner text is shown | No such logic exists; the corrected banner is shown unconditionally on every run reaching that step |
| TC-D15 | UC-D1-EC4, FR-1.6, FR-1.7 — **line 1452 SURVIVES** | The `enable` call at line 1452 is explicitly OUT OF SCOPE and MUST be unchanged | Post-fix `install.sh` | `sed -n '1452p' install.sh` (or grep for the literal call) | `claude plugin enable "$PLUGIN_REF"` (or the exact pre-fix text at that line) is present verbatim — this fix goes through the full pipeline per FR-1.6, and this line is the concrete non-regression proof that "messaging only" held |
| TC-D16 | Line 206 out of scope (AC-1) | Line 206's "Both parts are required" claim is a DIFFERENT, still-true claim and is UNCHANGED | Post-fix `install.sh` | `sed -n '206p' install.sh` | Text is byte-identical to pre-fix — this fix does not touch it |
| TC-D17 | `enable_plugin_for_project()` unchanged (FR-1.7) | Lines 1463–1474 (measured span, located by content — `enable_plugin_for_project()`'s actual function body, correcting the earlier 1467–1472 estimate) are retained capability, unmodified | Post-fix `install.sh` | Locate `enable_plugin_for_project()` by content (function definition through closing brace), not by the stale line estimate; diff that span against the pre-fix version | Byte-identical |

---

## 6. Group E (FR-2): `.gitignore` — `.claude/debug/`

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-E1 | UC-E1 (Primary), FR-2.1, AC-2 | `.gitignore` contains the ANCHORED entry | Post-fix `.gitignore` | `grep -Fx '/.claude/debug/' .gitignore` | Exactly one match, anchored form (leading `/`) |
| TC-E2 | UC-E1 (Primary), AC-2 | A file written under root `.claude/debug/` no longer appears in `git status` | Test checkout with FIX-gitignore-anchored applied; write `.claude/debug/wave-results/x.json` | `git status --porcelain` | Output contains no line referencing `.claude/debug/` |
| TC-E3 | UC-E1-A1, FR-2.1 | `.claude/debug/` did not previously exist — adding the entry is a no-op until first write | Checkout with no `.claude/debug/` directory yet, entry added | `git status --porcelain` | No observable diff attributable to the new entry |
| TC-E4 | UC-E1-A2, FR-2.1, AC-2 (fixture negative case, REQUIRED) | Anchored form does NOT shadow the three tracked debugger fixture files | Checkout with FIX-gitignore-anchored applied; the three known fixtures under `tests/fixtures/agents/debugger/*/.claude/debug/` present and tracked | `git ls-files tests/fixtures \| grep '\.claude/debug'`; `git check-ignore --no-index <each of the three fixture paths>` for each | `git ls-files` still returns all three; `git check-ignore --no-index` exits 1 ("not ignored") for each — `--no-index` used so the assertion can genuinely fail rather than being masked by the files' tracked status; the anchored, middle-of-path `/.claude/debug/` pattern is root-relative per gitignore semantics and does not match the deeper, differently-rooted fixture paths |
| TC-E5 | UC-E1-E1, FR-2.2, AC-2 | `.claude/scratchpad.md` and `.claude/instincts.md` remain tracked, not newly ignored | Checkout with FIX-gitignore-anchored applied, both files already committed | `git status --porcelain` after touching both files; `git check-ignore --no-index .claude/scratchpad.md .claude/instincts.md` | Neither appears as newly untracked/ignored; `git check-ignore --no-index` exits 1 (not ignored) for both — `--no-index` is required so the check genuinely evaluates the ignore pattern rather than short-circuiting on the files' already-tracked index status |
| TC-E6 | UC-E1-E2, FR-2.2 | No other tracked `.claude/*` file is affected | Checkout with `.claude/rules/*.md` and a sample `.claude/settings.json` tracked | `git ls-files .claude` before and after the `.gitignore` change | Identical set of tracked files, membership unchanged |
| TC-E7 | UC-E1-E3, FR-2.2 scope | No code that writes to `.claude/debug/` is modified by this fix | Diff of this feature's commit(s) | `git diff <feature-branch> -- hooks/handlers/subagent-stop-wave-record.js` and the `debugger` agent's write-path file | Empty diff for both — this fix's postcondition is entirely a `.gitignore`-content change |
| TC-E8 | UC-E1-E4, FR-2.1 (hard requirement, regression guard — corrected mechanism, measured against 2.1.237 `git`) | A genuinely shadowing pattern IS a regression, demonstrated with the pattern shape that actually shadows — a SEPARATOR-FREE pattern (`debug/`, no leading path segment), not the middle-separator unanchored form (`.claude/debug/`), which is measured to already be root-relative per gitignore semantics and does NOT shadow the fixtures | FIX-gitignore-separator-free (`debug/`) seeded via a temporary `excludesFile` pointed at the same working tree, applied ALONGSIDE (not replacing) the real, correct `.gitignore` entry from FIX-gitignore-anchored | (1) `git check-ignore --no-index <each of the three fixture paths>` under the separator-free `excludesFile` alone; (2) `git check-ignore --no-index <each of the three fixture paths>` under the real repo's `.gitignore` (FIX-gitignore-anchored) alone; both runs use `--no-index` so a genuine failure is possible rather than masked by tracked-index status | (1) exits 0 (ignored) for at least one of the three fixture paths — proving `debug/` DOES shadow, the concrete demonstration of what real shadowing looks like; (2) exits 1 (not ignored) for all three — proving the real, shipped `/.claude/debug/` entry does NOT shadow them, consistent with TC-E4 |
| TC-E9 | UC-E1-EC1, FR-2.1 (scope limit) | A file already committed under `.claude/debug/` from before this fix (if any) is not un-tracked by adding the entry | A synthetic pre-existing tracked file at `.claude/debug/legacy.json` (fixture-only, not asserting this exists in the real repo) | Add the `.gitignore` entry; `git status --porcelain` | The pre-existing tracked file is unaffected — `git rm --cached` would be required separately, out of this fix's scope, and this fix does not perform it |
| TC-E10 | UC-E1-EC2, AC-2 (motivating regression check) | Re-running the class of gate-agent check that flagged `.claude/debug/` as noise in the live run raises no flag against a populated directory | Checkout with FIX-gitignore-anchored applied and `.claude/debug/wave-results/` populated | Run `git status --porcelain` (the mechanism the flagging gate agents consulted) | No `.claude/debug/` entries appear — the motivating live-run observation (`docs/findings/live-pipeline-run-2026-08-20.md` §6) no longer reproduces |
| TC-E11 | UC-E1-EC3, FR-2.1 (anchoring semantics, depth) | Nested depth beneath the anchored root is still covered | `.claude/debug/wave-results/<safeId>.json` (one level deeper than the ignored directory) | `git check-ignore .claude/debug/wave-results/agent-1.json` | Exits 0 (ignored) — directory-pattern coverage extends to arbitrary nesting depth beneath the anchored root |

---

## 7. Group F (FR-6): Skill-Text Reconciliation

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-F1 | UC-F1, FR-6.1, AC-6 | `skills/merge-ready/SKILL.md`'s Finalization changelog step is compose-then-orchestrator-writes | Post-fix file | `grep -F "Delegate the actual file write to the \`doc-updater\` agent" skills/merge-ready/SKILL.md`; separately grep for compose/orchestrator wording | Zero matches for the stale sentence; wording present describing `doc-updater` composing the entry and the orchestrator performing the single write under the idempotency guard |
| TC-F2 | UC-F2, FR-6.2, AC-6 | Release step names `SDLC_ALLOW_GIT_GUARD=1` as the sanctioned mechanism | Post-fix file | `grep -F "SDLC_ALLOW_GIT_GUARD=1" skills/merge-ready/SKILL.md` | Present in the Release step's text |
| TC-F3 | UC-F3, FR-6.3, AC-6 | `skills/develop-feature/SKILL.md`'s Quick Tier Execution no longer contains "land in a later slice" | Post-fix file | `grep -F "land in a later slice" skills/develop-feature/SKILL.md` | Zero matches |
| TC-F4 | UC-F3, FR-6.3, AC-6, NFR-3 | `src/claude.md`'s byte-identical copy of the same stale sentence is ALSO removed | Post-fix file | `grep -F "land in a later slice" src/claude.md` | Zero matches — both files asserted, per AC-6's explicit "both files asserted" requirement |
| TC-F5 | UC-F4, FR-6.4, AC-6 | `develop-feature` step 1a's `agent_type` text updated with version-scoped fallback | Post-fix `skills/develop-feature/SKILL.md` | `grep -F "SubagentStop carries no agent_type" skills/develop-feature/SKILL.md`; separately grep step 1a for `2.1.237` and for an `agent_id`-fallback mention | The unqualified stale sentence is absent; the corrected text names both the 2.1.237-present case and the older-CLI `agent_id`-fallback case |
| TC-F6 | UC-F5, FR-6.5, AC-6 | Calibrated `tool_results_errored` rule replaces the absolute "must be 0" rule | Post-fix `skills/develop-feature/SKILL.md` | Grep step 1a for the absolute phrasing (`tool_results_errored is 0 before treating`, or equivalent) and for the calibrated phrasing (closer read on nonzero) | Absolute phrasing absent; calibrated phrasing present, naming both the `Verify:` command check and "never an automatic FAIL" |
| TC-F7 | UC-F-A1 (process) | The five reconciliations (F1–F5) are independently implementable/verifiable, with no ordering dependency among themselves | This document's own structure | Confirm TC-F1 through TC-F6 each run and pass in isolation, in any order, against the same post-fix checkout | Each passes independently — no test depends on another's prior execution |
| TC-F8 | UC-F-A2, PRD 13.10 Risk 3 | FR-6.4/FR-6.5's text describes actually-shipped Group B/C behavior, not aspirational wording | Post-fix `skills/develop-feature/SKILL.md`, Group B/C already shipped in the same feature | Cross-check the step 1a text against the actual bound regex `/^[A-Za-z0-9:_-]{1,64}$/` semantics and the actual `systemMessage` advisory behavior implemented in Groups B/C | The text's description matches the implemented behavior (e.g. does not claim `agent_type` blocks anything, does not claim a stricter bound than what shipped) |
| TC-F9 | UC-F-E1, NFR-3 | `validate-triage-parity`'s protected Steps 1–7 region is untouched by F3–F5's edits | Post-fix `skills/develop-feature/SKILL.md` and `src/claude.md` | `node scripts/ci/validate-triage-parity.js` | Passes unmodified after each of TC-F3/TC-F4/TC-F5/TC-F6's edits |
| TC-F10 | UC-F-E2, NFR-3 | `validate-instinct-discipline`'s pinned `merge-ready` clauses are untouched by F1–F2's edits | Post-fix `skills/merge-ready/SKILL.md` | `node scripts/ci/validate-instinct-discipline.js` | Passes unmodified after TC-F1/TC-F2's edits |
| TC-F11 | UC-F-E3, NFR-3 | No edit strays outside the four named locations | Diff of this feature's commit(s) touching either `SKILL.md` file | `git diff <feature-branch> -- skills/merge-ready/SKILL.md skills/develop-feature/SKILL.md` | Every changed line range falls within Finalization/Release (merge-ready) or Quick Tier Execution/Step 1a (develop-feature) — no unrelated section touched |
| TC-F12 | UC-F-EC1, FR-6.4 (scope limit) | FR-6.4's corrected text is version-scoped, not phrased as a permanent claim | Post-fix `skills/develop-feature/SKILL.md` | Grep step 1a's `agent_type` text for `2.1.237` and confirm no unqualified "always"/"never absent" phrasing | `2.1.237` present; no unqualified permanence claim |
| TC-F13 | UC-F-EC2, non-regression | Other Finalization sub-steps (Consolidate Instincts, version-bump sequencing) in `skills/merge-ready/SKILL.md` are unaffected | Diff of the feature's commit against `skills/merge-ready/SKILL.md` | Diff restricted to non-F1/F2 sections | No changes outside the two named sentences |

---

## 8. Group X — Cross-Cutting NFR/AC Sweep

| TC ID | UC Scenario | Test Case | Preconditions | Steps | Expected Result |
|---|---|---|---|---|---|
| TC-X1 | UC-X1 (Primary, step 1), NFR-1, AC-7 | `hooks/hooks.json`'s distinct hook-id count remains 12 | All six groups' slices landed | Parse `hooks/hooks.json`, count distinct `id` values across all registrations | Exactly 12 — FR-3's matcher widening reuses the existing id, no new id added by any group |
| TC-X2 | UC-X1 (Primary, step 2), NFR-1 | `tests/hooks/test-guards-cross.js`'s handler-count assertion passes unmodified | Same | `node tests/hooks/test-guards-cross.js` | Passes; the `=== 12` assertion (line ~170) unmodified and green |
| TC-X3 | UC-X1 (Primary, step 3), NFR-2, AC-7 | Version `4.6.0` present in all four declared sources | Same | Read `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `install.sh`'s `VERSION=`, `README.md`'s badge | All four read `4.6.0` |
| TC-X4 | UC-X1 (Primary, step 4), AC-7 | `validate-version-consistency` passes | Same | `node scripts/ci/validate-version-consistency.js` | Exit 0 |
| TC-X5 | UC-X1 (Primary, step 5), AC-7 | Full validator/test sweep passes | Same | `for v in scripts/ci/validate-*.js; do node "$v" \|\| exit 1; done`; `for t in tests/hooks/test-*.js; do node "$t" \|\| exit 1; done` | Both loops exit 0 |
| TC-X6 | UC-X1 (Primary, step 6), NFR-6 | README/docs rows describing changed behavior are updated, none left stale | Same | Grep `README.md`'s read-guard row (~382) and gate-evidence rows (~394–400) for stale wording (e.g. "no agent_type", old matcher description) | No stale row remains; rows reflect FR-3/FR-4/FR-5's shipped behavior |
| TC-X7 | UC-X1-A1, NFR-2 | Version bump rides the FIRST code-touching commit, not the last | Feature's commit history | `git log` across the feature branch; inspect the first code-touching commit's diff for the version-string changes | The version bump is present in the first code-touching commit; intermediate commits' validator sweeps (`validate-release-readiness`) report the pre-release-OK state consistently |
| TC-X8 | UC-X1-E1, PRD 13.10 Risk 1 | Sequencing violation (Group C before Group B) is caught before merge | Implementation plan for this feature | Inspect the plan's slice ordering (or `plan-critic`'s recorded findings) for Group B strictly preceding Group C | Group B (FR-4) slices are ordered before Group C (FR-5) slices; a plan violating this ordering is flagged BLOCKER-tier by `plan-critic` per this use case's stated mitigation |

---

## Traceability

| Use Case | Test Cases |
|---|---|
| UC-A1 (Primary) | TC-A1, TC-A2 |
| UC-A1-A1 | TC-A3 |
| UC-A1-A2 | TC-A4 |
| UC-A1-A3 | TC-A5 |
| UC-A1-E1 | TC-A6 |
| UC-A1-E2 | TC-A7 |
| UC-A1-E3 | TC-A8 |
| UC-A1-E4 | TC-A9, TC-A10 |
| UC-A1-E5 | TC-A11 |
| UC-A1-EC1 | TC-A12 |
| UC-A1-EC2 | TC-A13 |
| UC-A1-EC3 | TC-A14 |
| UC-A1-EC4 | TC-A2, TC-A18 |
| UC-A1-EC5 | TC-A15, TC-A16 |
| (kill-switch non-regression) | TC-A17 |
| UC-B1 (Primary) | TC-B1 |
| (existing blocks non-regression) | TC-B2 |
| UC-B1-A1 | TC-B3, TC-B11 |
| UC-B1-A2 | TC-B4 |
| UC-B1-E1 | TC-B5 |
| UC-B1-E2 | TC-B6 |
| UC-B1-E3 | TC-B7 |
| UC-B1-EC1 | TC-B8, TC-B9, TC-B10 |
| UC-B1-EC2 (use-case text superseded by authoritative FR-4.2 resolution — see TC-B11's expectation) | TC-B11 |
| UC-B1-EC3 | TC-B12 |
| (session_id capture, FR-4, measured 2.1.237 — new) | TC-B13 |
| UC-B1-E-family (FR-4.4 hardening, non-string agent_id — new) | TC-B14 |
| UC-C1 (Primary) | TC-C1 |
| UC-C1-A1 | TC-C2 |
| UC-C1-A2 | TC-C3 |
| UC-C1-A3 | TC-C4 |
| UC-C1-E1 | TC-C5 |
| UC-C1-E2 | TC-C6 |
| UC-C1-E3 | TC-C7 |
| UC-C1-E4 | TC-C8 |
| UC-C1-EC1 | TC-C9 |
| UC-C1-EC2 | TC-C10 |
| UC-C1-EC3 | TC-C11 |
| UC-C1-EC4 | TC-C12 |
| UC-C1-EC5 | TC-C13 |
| (hostile content / symlink / allowlist-only hardening) | TC-C14, TC-C15, TC-C16 |
| (session_id attribution filter, FR-5.3, measured 2.1.237 — new) | TC-C17, TC-C18, TC-C19 |
| UC-D1 (Primary) | TC-D1, TC-D2, TC-D3, TC-D4 |
| UC-D1-A1 | TC-D5 |
| UC-D1-A2 | TC-D6 |
| UC-D1-A3 | TC-D7 |
| UC-D1-A4 | TC-D8 |
| UC-D1-E1 | TC-D9 |
| UC-D1-E2 | TC-D10 |
| UC-D1-E3 | TC-D11 |
| UC-D1-EC1 | TC-D1, TC-D12 |
| UC-D1-EC2 | TC-D13 |
| UC-D1-EC3 | TC-D14 |
| UC-D1-EC4 | TC-D15, TC-D16, TC-D17 |
| UC-E1 (Primary) | TC-E1, TC-E2 |
| UC-E1-A1 | TC-E3 |
| UC-E1-A2 | TC-E4 |
| UC-E1-E1 | TC-E5 |
| UC-E1-E2 | TC-E6 |
| UC-E1-E3 | TC-E7 |
| UC-E1-E4 | TC-E8 |
| UC-E1-EC1 | TC-E9 |
| UC-E1-EC2 | TC-E10 |
| UC-E1-EC3 | TC-E11 |
| UC-F1 | TC-F1 |
| UC-F2 | TC-F2 |
| UC-F3 | TC-F3, TC-F4 |
| UC-F4 | TC-F5 |
| UC-F5 | TC-F6 |
| UC-F-A1 | TC-F7 |
| UC-F-A2 | TC-F8 |
| UC-F-E1 | TC-F9 |
| UC-F-E2 | TC-F10 |
| UC-F-E3 | TC-F11 |
| UC-F-EC1 | TC-F12 |
| UC-F-EC2 | TC-F13 |
| UC-X1 (Primary) | TC-X1, TC-X2, TC-X3, TC-X4, TC-X5, TC-X6 |
| UC-X1-A1 | TC-X7 |
| UC-X1-E1 | TC-X8 |
