# Plan: Telegram channel — official TSX plugin → claudebase Rust port

**Owner:** Mira (orchestrator, autonomous — no SDLC pipeline)
**Status:** active
**Created:** 2026-05-23

## Context

Previously we tried to build the Telegram channel integration directly as a
Rust feature inside `claudebase`. The daemon + UDS forwarder worked
end-to-end (verified in `/tmp/claudebase-plugin-trace.log` — frames reached
plugin stdout), but Claude Code 2.1.144 never surfaced the
`<channel source="claudebase" ...>` tag to the orchestrator. Documented as
`docs/issues/002-channel-surface-not-firing-2.1.144.md` in the claudebase
repo. Working hypothesis: the dual-plugin-process model in our Rust
implementation lost the subscription↔listener correlation (the tools
process subscribed, the listener process got the broadcast).

The **official Anthropic Telegram plugin**
(`anthropics/claude-plugins-official/external_plugins/telegram`) is a
**single-bun-process** plugin (1038 lines `server.ts`, Apache-2.0). It
**does** surface callbacks correctly in CC 2.1.144 — verified visually in
the prior session (`← telegram · codefather_dev: 123`). So the wire format
is reachable; our previous Rust impl had a process-topology issue, not a
CC bug.

**Strategy:** take the known-working TSX plugin as baseline, then port to
Rust incrementally inside claudebase with feature parity verified at every
step.

## Acceptance per phase

### Phase 1 — Baseline: official TSX plugin works end-to-end

Most of this is already done in the prior session; the remaining work is
to confirm callbacks reach the **current** session live.

- [x] Plugin installed: `telegram@claude-plugins-official` v0.0.6 (verified at
      `~/.claude/plugins/installed_plugins.json`).
- [x] Bot token configured: `~/.claude/channels/telegram/.env` exists,
      `chmod 0600`.
- [x] User in allowlist: `434566766` in
      `~/.claude/channels/telegram/access.json`.
- [x] Bot polling process alive: PID file points to a live `bun server.ts`.
- [ ] **Smoke-test (live):** start a fresh `claude --channels plugin:telegram@claude-plugins-official`,
      DM the bot from `@codefather_dev`, confirm Mira's input receives
      `<channel source="telegram" chat_id="434566766" user="codefather_dev" ts="..." message_id="...">…</channel>`.
- [ ] **Reply round-trip:** Mira calls `mcp__telegram__reply`
      `{chat_id: 434566766, text: "…"}`, user sees the reply in TG.
- [ ] **Permission-request flow:** Mira asks for permission to perform a
      sensitive operation; the request appears in TG with inline
      yes/no buttons; user taps a button; the callback flows back via
      `notifications/claude/channel/permission`.

**Open in Phase 1:** the installed plugin's marketplace currently points at
`codefather-labs/claude-plugins-official` (user's fork), not at
`anthropics/claude-plugins-official`. Likely an artifact of prior testing;
decide in Phase 1 whether to switch upstream to the canonical Anthropic
marketplace (less drift) or keep the fork (if the fork has user patches).
**Action item:** diff fork vs upstream, decide.

### Phase 2 — Port code into claudebase repo

Goal: make claudebase the source of truth for the Telegram plugin so we
can iterate on it without depending on the upstream marketplace, and so
the Rust port (Phase 3) lives alongside its TSX reference.

Standalone — does **not** integrate with the claudebase daemon/UDS stack.
The existing claudebase TG code (daemon/chat.rs, plugin/bridge.rs, etc.)
stays as-is for now; if the Rust port (Phase 3) eventually subsumes it,
that's a separate decision.

- [ ] Create `claudebase/plugins/telegram/` directory with the full
      contents of `external_plugins/telegram/` from upstream:
      `server.ts`, `.claude-plugin/plugin.json`, `.mcp.json`, `skills/`,
      `README.md`, `ACCESS.md`, `package.json`, `bun.lock`, `.npmrc`.
- [ ] **License compliance (Apache-2.0):** copy upstream `LICENSE`
      verbatim. Add a `NOTICE` file with:
      `Telegram plugin — forked from anthropics/claude-plugins-official
      (Apache-2.0). Original copyright holders retain rights to their
      contribution.`
- [ ] Update `claudebase/.claude-plugin/marketplace.json` to publish the
      plugin under `claudebase-dev` marketplace:
      `{name: "telegram-claudebase", source: "./plugins/telegram"}`
      (renamed to avoid collision with the upstream `telegram` slug).
- [ ] Install from claudebase marketplace:
      `/plugin install telegram-claudebase@claudebase-dev`.
- [ ] Re-run **all** Phase 1 acceptance criteria pointing at the new
      plugin slug. PASS = Phase 2 done.

### Phase 3 — Incremental TSX → Rust rewrite

Goal: replace `server.ts` with a Rust binary delivered by the existing
claudebase release pipeline. End state: the user no longer needs `bun`
installed; the plugin is a single static binary.

Each wave's Done-condition = the relevant subset of Phase 1 acceptance
criteria still PASSES on the Rust plugin.

#### Wave 3a — Rust skeleton
- New crate `claudebase/crates/telegram-plugin-rs/` (or as a subcommand
  of the main `claudebase` binary — TBD in 3a).
- `.claude-plugin/plugin.json` + `.mcp.json` pointing at the Rust binary.
- MCP server stub: implements `initialize`, `tools/list` (empty array),
  `tools/call` (returns "not implemented" error for any tool).
- **Done when:** `/plugin install …` works, `tools/list` returns empty
  array, no errors in CC logs.

#### Wave 3b — Port access control (pure logic, no TG yet)
- Read `~/.claude/channels/telegram/access.json` schema-equivalently to
  TSX: `dmPolicy`, `allowFrom`, `groups`, `pending`, expiry pruning.
- Implement: `loadAccess`, `saveAccess`, `gate`, `dmCommandGate`,
  `isMentioned`, `checkApprovals`, pairing code generation.
- Unit tests using `access.json` fixtures from TSX test cases.
- **Done when:** Rust impl passes the same access-control logic tests
  as TSX (we write the test fixtures from TSX behavior).

#### Wave 3c — Add the TG transport layer
- Add `teloxide` (or `frankenstein` or `tbot`) crate — Rust analog of
  grammy. Pick on (1) maintenance status, (2) long-polling
  ergonomics, (3) compile time, (4) ability to handle message types
  TSX handles (text/photo/document/voice/audio/video/video_note/sticker).
- Implement long-polling loop + PID-file stale-poller eviction
  (mirror lines 56-66 of TSX `server.ts`).
- On inbound message → emit `mcp.notification('notifications/claude/channel/...')`
  with the byte-equivalent payload TSX emits.
- **Done when:** DM the bot → Mira sees the channel callback. (Re-run
  Phase 1 smoke-test against the Rust plugin.)

#### Wave 3d — Port MCP tools
- `mcp__telegram__reply` — text + files attachment + chunking + reply_to.
- `mcp__telegram__react` — whitelist emoji.
- `mcp__telegram__edit_message`.
- Tool descriptions copied verbatim from `server.ts:445-518` for parity.
- **Done when:** Mira can reply / react / edit from Rust plugin; user
  sees the actions in TG. (Re-run Phase 1 reply round-trip criterion.)

#### Wave 3e — Photo / attachment downloads
- Inbox dir: `~/.claude/channels/telegram/inbox/`.
- Photos download eagerly on arrival.
- Channel notification includes the local path.
- **Done when:** sending a photo from TG results in a `<channel … image_path="…">` Mira can `Read`.

#### Wave 3f — Permission-request flow
- Register notification handler for `notifications/claude/channel/permission_request`.
- Generate inline keyboard buttons (yes/no) + send to TG.
- Map button-press → reply via `notifications/claude/channel/permission`.
- `pendingPermissions` map with TTL.
- **Done when:** sensitive Mira op → TG shows yes/no → tap → operation
  proceeds or aborts. (Re-run Phase 1 permission-request criterion.)

#### Wave 3g — Cutover
- Mark TSX plugin in claudebase marketplace as deprecated (or remove).
- Rust plugin becomes canonical `telegram` slug under `claudebase-dev`.
- Update claudebase README + this plan's status to `complete`.

## Risks

| Risk | Mitigation |
|---|---|
| CC 2.1.144 channel surface ever changes wire format | TSX plugin is upstream-maintained by Anthropic — track its commits; Rust port mirrors its behavior. |
| teloxide / chosen TG crate has different semantics than grammy | Smoke-test EACH event type (text / photo / document / voice / video / etc) in Wave 3c before claiming parity. |
| Apache-2.0 attribution accidentally stripped during port | LICENSE + NOTICE files committed in Phase 2; verify on every PR via CI grep for `Apache-2.0` in plugin dir. |
| Two getUpdates pollers fighting over the TG token slot | Port the stale-PID eviction logic (TSX lines 56-66) verbatim into Rust Wave 3c. |
| User's existing `codefather-labs/claude-plugins-official` fork drifts from upstream | Phase 1 action item: diff fork vs upstream, decide canonical source. |
| Rust port discovers an undocumented TSX behavior late | Each wave's Done-condition re-runs Phase 1 acceptance — regression catches missing behavior immediately. |

## Files (planned changes)

**Phase 2 (in `claudebase/` repo, separate commit):**
- `claudebase/plugins/telegram/server.ts` (forked from upstream)
- `claudebase/plugins/telegram/.claude-plugin/plugin.json`
- `claudebase/plugins/telegram/.mcp.json`
- `claudebase/plugins/telegram/skills/access/SKILL.md`
- `claudebase/plugins/telegram/skills/configure/SKILL.md`
- `claudebase/plugins/telegram/{LICENSE,NOTICE,README.md,ACCESS.md,package.json,bun.lock,.npmrc}`
- `claudebase/.claude-plugin/marketplace.json` (publish entry)

**Phase 3 (in `claudebase/` repo):**
- `claudebase/crates/telegram-plugin-rs/` (Cargo crate) — or a subcommand
  of main binary, decided in 3a.
- `claudebase/plugins/telegram-rs/` (manifest + `.mcp.json`)
- `claudebase/.claude-plugin/marketplace.json` (3g cutover)

## Out of scope

- Inter-Mira-CLI communication via claudebase (user's banked idea).
- ASR backend (whisper feature, off-topic).
- Subsuming the existing claudebase TG daemon — separate decision after
  Wave 3g.
- The Discord / Matrix / etc analogous plugins — same pattern but separate
  scope.

## Facts

### Verified facts
- Telegram plugin upstream is `anthropics/claude-plugins-official/external_plugins/telegram`, 1038-line `server.ts`, license Apache-2.0 — verified by direct read of cloned `/tmp/claude-plugins-official/external_plugins/telegram/{package.json,server.ts}` and `LICENSE` file (Apache-2.0 confirmed in `package.json` line 4). Salience: high.
- Plugin uses `@modelcontextprotocol/sdk` + `grammy` as its only runtime deps (`package.json` lines 11-14). Single bun process; `bin: ./server.ts`. Salience: high.
- Channel callback emission shape: `mcp.notification({ method: 'notifications/claude/channel/...', params: {...} })` — verified in `server.ts:772`. Salience: high.
- Local install state — `telegram@claude-plugins-official` v0.0.6 installed at `~/.claude/plugins/cache/claude-plugins-official/telegram/0.0.6`, `installedAt: 2026-05-19T17:41:37Z` — verified from `~/.claude/plugins/installed_plugins.json`. Salience: medium.
- User's bot token + allowlist persist from prior session: `~/.claude/channels/telegram/.env` (chmod 0600) + `~/.claude/channels/telegram/access.json` with `allowFrom: ["434566766"]` and `dmPolicy: "pairing"` — verified by reading both. Salience: medium.
- Bot polling process is currently live at PID 33899 (`bun server.ts`) — verified via `ps -p`. Salience: low (will likely restart with each new Claude Code session anyway).
- The marketplace `claude-plugins-official` in `~/.claude/plugins/known_marketplaces.json` resolves to `codefather-labs/claude-plugins-official` (user's fork), NOT `anthropics/claude-plugins-official` — verified by direct read. Salience: medium (Phase 1 action item).
- `bun` is installed at `/opt/homebrew/bin/bun` — verified by `which`. Salience: low.

### External contracts
- `@modelcontextprotocol/sdk` — symbol: `Server`, `StdioServerTransport`, `ListToolsRequestSchema`, `CallToolRequestSchema`, `mcp.notification(...)` — source: TSX imports at `server.ts:13-18`, official npm package — verified: yes (read in TSX source). Salience: high — Rust port must match this exact wire shape.
- `grammy` — symbol: `Bot`, `InlineKeyboard`, `InputFile`, `Context`, `ReactionTypeEmoji` — source: TSX imports `server.ts:20-21` — verified: yes (read in TSX source). Replacement for Rust port (Wave 3c) is TBD — candidates `teloxide`, `frankenstein`, `tbot`. Salience: high.
- Telegram Bot API — symbol: `getUpdates` long-polling, single-consumer-per-token semantic (409 Conflict if two pollers) — source: TSX comments `server.ts:56-58` + Telegram official docs — verified: yes (TSX behavior is canonical). Salience: high.
- Claude Code channel surface — symbol: `notifications/claude/channel/...` notification methods, `--channels plugin:<slug>@<marketplace>` CLI flag, `mcp__<plugin>__<tool>` MCP tool naming — source: TSX usage + CC plugin docs at https://code.claude.com/docs/en/plugins — verified: yes (docs WebFetched this session, TSX usage matches). Salience: high.
- Apache License 2.0 — symbol: requires preserving copyright notice + license text, allows modification + redistribution + sublicensing under same or compatible terms — source: standard Apache-2.0 text; will live verbatim in `claudebase/plugins/telegram/LICENSE` — verified: yes (license string in upstream `package.json` line 4). Salience: high.

### Assumptions
- The TSX plugin still works in CC 2.1.144 *today* — based on user verbal confirmation in the prior session. **How to verify:** Phase 1 smoke-test (the first un-checked checkbox in Phase 1). Risk: if it no longer works, the whole strategy collapses — surface immediately as BLOCKED. Salience: high.
- The user wants the Phase 3 Rust port to live as a separate crate in claudebase (not as a subcommand of the main `claudebase` binary). **How to verify:** revisit in Wave 3a — decision deferred. Salience: medium.
- The user's fork `codefather-labs/claude-plugins-official` does not have load-bearing patches relative to upstream. **How to verify:** Phase 1 action item — diff fork vs upstream before Phase 2 starts. Salience: medium.
- `teloxide` or another mature Rust TG crate covers all 8 message types TSX handles (text/photo/document/voice/audio/video/video_note/sticker). **How to verify:** Wave 3c per-type smoke-test. Salience: medium.

### Open questions
- Should Phase 2 keep the upstream slug `telegram` (and accept marketplace collision) or rename to `telegram-claudebase`? — needs: user decision; deferred to Phase 2 kickoff. Salience: medium.
- For Phase 3, does the Rust impl live as a standalone crate or as a subcommand of the main claudebase binary? — needs: architect call in Wave 3a. Salience: medium.
- Does the existing claudebase Telegram code (daemon/chat.rs, plugin/bridge.rs) get removed after Wave 3g? — needs: user decision after Wave 3g. Per the prior session the user said "пусть остается пока что" — so default is keep, revisit later. Salience: low.

## Decisions

### Inbound validation
- Task as given: "integrate official TG plugin → port into claudebase → rewrite to Rust." Challenged Q1 (nonsense?): no — coherent baseline-bisect-then-port strategy. Challenged Q2 (upstream error?): no — pivoting from the failing claudebase Rust attempt to a known-working reference IS the correct fix for the prior failure. Outcome: proceed as-is. Salience: high.

### Decisions made
- **Decision:** 3-phase plan (verify TSX → fork into claudebase → port to Rust) rather than direct rewrite. Alternatives considered: (a) skip Phase 1 and immediately fork (rejected — without local end-to-end verification we can't be sure the plugin works on user's specific CC version), (b) skip Phase 2 and port directly from upstream (rejected — losing the TSX-in-claudebase reference means we'd have nothing to compare the Rust port against). Q1-Q5: not a hack ✓ / proportionate ✓ / alternatives evaluated ✓ / addresses root cause (dual-process topology) ✓ / n/a (no symptom-only) ✓. Salience: high.
- **Decision:** Standalone — does NOT integrate with existing claudebase daemon. Confirmed by user via AskUserQuestion this session. Alternative (UDS integration) rejected because: (a) more work before first callback works, (b) the prior daemon-based attempt already failed to surface callbacks. Salience: high.
- **Decision:** Plan file at `docs/plans/telegram-tsx-to-rust.md` rather than `.claude/plan.md` (which is reserved for the SDLC pipeline's bootstrap-feature workflow). Confirmed by user via AskUserQuestion. Salience: low.
- **Decision:** Phase 2 namespaces the plugin as `telegram-claudebase` to avoid collision with the existing `telegram@claude-plugins-official` install. May revisit if user prefers to overwrite the upstream slug. Salience: medium.

### Hacks acknowledged
(none) — the plan is a port plan; the existing TSX plugin is the reference, not a hack.

### Symptom-only patches
(none) — we're addressing the root cause of the prior failure (dual-process channel-surface mismatch) by adopting a single-process reference architecture.
