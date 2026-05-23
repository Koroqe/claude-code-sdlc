# Plan: Rust port of Telegram plugin — sandboxed, toggle-able, fallback to TSX

**Owner:** Mira (orchestrator, autonomous — no SDLC pipeline)
**Status:** active
**Created:** 2026-05-23
**Related:** [`telegram-tsx-to-rust.md`](./telegram-tsx-to-rust.md) — supersedes its Phase 3 (incremental claudebase rewrite) with this focused safe-cutover approach.

## Goal

Replace the bun-based TSX Telegram plugin with a Rust implementation **without
breaking the working TSX baseline** until the Rust impl reaches feature parity.

## Constraints (from operator's brief)

- Write the Rust code **in this repository** (`claude-code-sdlc/`), NOT directly
  in `~/.claude/plugins/cache/...`. Git history is the safety net.
- The compiled binary is **deployed** to the plugin cache directory as
  `server-rs`, side-by-side with the existing `server.ts` (TSX patched with
  whisper in Phase 1.5).
- Switch between TSX and Rust via **env var toggle** in `.mcp.json`. Default
  remains TSX. No destructive cutover.
- All git operations require **explicit operator approval**
  ([feedback memory](../../../.claude/projects/-Users-aleksandra-Documents-claude-code-sdlc/memory/feedback_no_commit_without_signal.md)).
- TSX plugin (Apache-2.0) is the upstream source — Rust port preserves
  attribution via `NOTICE` and `LICENSE` files in the Rust crate.

## Where work lives

```
claude-code-sdlc/
└── telegram-plugin-rs/                  ← NEW (this work)
    ├── Cargo.toml
    ├── LICENSE                          ← Apache-2.0 verbatim from upstream
    ├── NOTICE                           ← attribution to anthropics/claude-plugins-official
    ├── README.md                        ← build + deploy instructions
    └── src/
        ├── main.rs                      ← entry point: env setup, supervisor
        ├── mcp/                         ← MCP server (JSON-RPC over stdio)
        │   ├── mod.rs
        │   ├── server.rs                ← initialize / tools/list / tools/call
        │   ├── notification.rs          ← channel notification emission
        │   └── tools.rs                 ← reply / react / edit_message tool schema
        ├── telegram/                    ← TG bot module
        │   ├── mod.rs
        │   ├── bot.rs                   ← long-polling loop (frankenstein crate)
        │   ├── handlers.rs              ← message handlers per type
        │   └── api.rs                   ← outbound calls (sendMessage, etc.)
        ├── access/                      ← access control
        │   ├── mod.rs
        │   ├── state.rs                 ← access.json read/write/prune
        │   ├── gate.rs                  ← dmPolicy / allowFrom / groups eval
        │   └── pairing.rs               ← pairing code lifecycle
        ├── whisper.rs                   ← transcribeVoice via std::process::Command
        └── state.rs                     ← STATE_DIR / ENV_FILE / PID_FILE / INBOX_DIR
```

```
~/.claude/plugins/cache/claude-plugins-official/telegram/0.0.6/
├── server.ts                            ← TSX (kept untouched after Phase 1.5)
├── server.ts.upstream-backup            ← pristine v0.0.6 backup
├── server-rs                            ← NEW Rust binary (built + copied)
├── .mcp.json                            ← PATCHED with toggle
└── ...other files unchanged
```

## Toggle mechanism

Patched `.mcp.json`:

```json
{
  "mcpServers": {
    "telegram": {
      "command": "bash",
      "args": [
        "-c",
        "if [ -n \"$TELEGRAM_USE_RUST_SERVER\" ] && [ -x \"$CLAUDE_PLUGIN_ROOT/server-rs\" ]; then exec \"$CLAUDE_PLUGIN_ROOT/server-rs\"; else exec bun run --cwd \"$CLAUDE_PLUGIN_ROOT\" --shell=bun --silent start; fi"
      ]
    }
  }
}
```

- Default: TSX (current working setup). No env var → TSX runs.
- Opt-in to Rust: `TELEGRAM_USE_RUST_SERVER=1 claude --channels …` → Rust runs.
- Safety: if `server-rs` is missing/non-executable, falls back to TSX even
  with env var set.

## Library choices

| Concern | Choice | Why |
|---|---|---|
| MCP server | Hand-rolled (port patterns from `claudebase/src/plugin/mcp.rs`) | No mature Rust MCP SDK; claudebase has working JSON-RPC stdio handler. Single-process variant — NOT the dual-process daemon model that previously failed channel surface. |
| Telegram Bot API | `frankenstein` crate | Direct 1:1 mapping to Telegram Bot API methods; less compile-time overhead vs teloxide; lower magic; matches grammy's "just call the API" philosophy. |
| Async runtime | `tokio` | Industry default; `frankenstein` has tokio support; required for non-blocking polling + concurrent reply handlers. |
| HTTP client | `reqwest` (used by frankenstein) | Standard. Used for whisper model download too. |
| JSON | `serde` + `serde_json` | Standard. Required for MCP JSON-RPC + Telegram API. |
| Whisper transcription | `std::process::Command` against `whisper-cli` binary | Matches TSX strategy (subprocess). Avoids `whisper-rs` FFI complexity for v1. May upgrade to `whisper-rs` later. |
| Audio re-encoding | `std::process::Command` against `ffmpeg` | Same approach as TSX. |
| State files | `serde_json` + atomic `rename` | Standard pattern for crash-safe write. |

## Build target

`cargo build --release --bin telegram-plugin-rs` produces a single static binary
(modulo libc + libpdfium-style runtime libs — but we don't need pdfium here).

For deploy: build → copy `target/release/telegram-plugin-rs` to
`~/.claude/plugins/cache/.../server-rs` → `chmod +x`.

## Slices

Slice-by-slice, each one ends with a working binary that passes a subset of
Phase 1 acceptance from the parent plan.

### Slice R1 — Crate scaffold + minimal MCP echo
- `Cargo.toml` with `tokio`, `serde`, `serde_json` deps only.
- `main.rs` reads JSON-RPC requests from stdin, writes responses to stdout.
- Handles `initialize` (returns server capabilities) and `tools/list` (returns
  empty array). Logs everything to stderr.
- LICENSE + NOTICE + README.md written.
- **Done when:** `echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | ./server-rs` returns a valid InitializeResult.

### Slice R2 — Wire toggle, verify Rust binary actually loads as plugin
- Build the Slice R1 binary.
- Copy to plugin cache as `server-rs`, chmod +x.
- Patch `.mcp.json` with the bash toggle.
- Restart CC with `TELEGRAM_USE_RUST_SERVER=1` env var.
- Verify the plugin loads (does NOT crash) and `tools/list` returns empty array.
- TSX continues to work when env var unset.
- **Done when:** both modes load cleanly per `/reload-plugins` and `/plugin`.

### Slice R3 — TG long-polling skeleton + access.json read
- Add `frankenstein`, `reqwest`, `tokio` to Cargo.toml.
- Read `~/.claude/channels/telegram/.env` to load `TELEGRAM_BOT_TOKEN`.
- Read `~/.claude/channels/telegram/access.json` schema-equivalently to TSX
  (`dmPolicy`, `allowFrom`, `groups`, `pending`).
- Long-polling loop via `frankenstein::AsyncApi::get_updates_async()` with retry
  on 409 (mirror TSX lines 994-1037).
- PID file write + stale-PID eviction (mirror TSX lines 56-67).
- On message received → log to stderr (no MCP notification yet).
- **Done when:** DM the bot from `@codefather_dev` → message shows in stderr;
  second instance gets 409 and yields.

### Slice R4 — Channel notification emission
- Implement `mcp::notification::emit_channel_message()` — writes a notification
  JSON-RPC message to stdout in the exact format CC expects.
- Wire the message handler: inbound TG text → emit notification.
- Match TSX wire format byte-for-byte (capture from current TSX run via
  `bun server.ts 2>/tmp/tsx-trace.log` and diff).
- **Done when:** DM the bot → Mira sees `<channel source="..." ...>` in her
  input (matches Phase 1 acceptance #5 from parent plan).

### Slice R5 — Reply tool
- Register MCP tool `reply` with same schema as TSX `server.ts:445-498`.
- Handle `tools/call` for `reply` → call `frankenstein::AsyncApi::send_message_async`.
- Implement chunking (4096 char limit).
- File attachment support (photos go as photos, others as documents).
- **Done when:** `mcp__telegram__reply` from Mira → user sees text in TG
  (matches Phase 1 acceptance #6 from parent plan).

### Slice R6 — Gate / pairing / groups
- Port `gate()`, `dmCommandGate()`, `isMentioned()`, `pruneExpired()`,
  `loadAccess()`, `saveAccess()`, `defaultAccess()` from TSX.
- Apply gate to every inbound message before notification emission.
- Implement pairing code generation + bot reply for pairing flow.
- Implement `/start`, `/help`, `/status` bot commands.
- **Done when:** unknown user DM → pairing code returned in TG; existing
  allowed user DM → notification emitted; group with `requireMention:true` →
  only @mentions trigger notification.

### Slice R7 — All inbound message types
- Handlers for: text, photo, document, voice, audio, video, video_note,
  sticker (mirror TSX `server.ts:787-895`).
- Photo download to `~/.claude/channels/telegram/inbox/`, include path in
  `image_path` attribute.
- All notifications include `attachment_kind` / `attachment_file_id` /
  `attachment_size` / `attachment_mime` as TSX does.
- **Done when:** sending each type → Mira sees correct channel notification.

### Slice R8 — React + edit_message tools
- Port emoji whitelist from TSX `server.ts:412-444`.
- Implement `react` tool → `frankenstein::AsyncApi::set_message_reaction_async`.
- Implement `edit_message` tool → `frankenstein::AsyncApi::edit_message_text_async`.
- **Done when:** Mira can react + edit; user sees in TG.

### Slice R9 — Voice transcription via whisper-cli subprocess
- Port `transcribeVoice` (TSX `server.ts:1230-1297`) to Rust.
- Auto-resolve `ffmpeg` + `whisper-cli` binaries (port `findBinary` +
  `findPkgManager`).
- Auto-download model if missing (port `ensureWhisper`).
- Voice handler: caption-first, else transcribe, else `(voice message)`
  fallback.
- **Done when:** voice DM → Mira sees `[voice transcription] ...` in
  notification (matches Phase 1.5 acceptance).

### Slice R10 — Permission-request flow
- Register notification handler for `notifications/claude/channel/permission_request`.
- Inline keyboard with yes/no buttons sent to TG.
- `callback_query:data` handler → emit `notifications/claude/channel/permission`
  with the decision.
- `pendingPermissions` map with TTL.
- **Done when:** Mira asks for sensitive permission → buttons in TG → tap →
  operation proceeds (matches Phase 1 acceptance #7 from parent plan).

### Slice R11 — Parity test + default-flip
- Run all parent-plan Phase 1 + 1.5 acceptance criteria against Rust.
- If all green: flip default in `.mcp.json` to Rust (TSX becomes opt-in via
  `TELEGRAM_USE_TSX_SERVER=1`).
- If any red: surface the failing case as a follow-up slice.
- **Done when:** new CC session boots into Rust by default and all 7 Phase 1
  + 1.5 acceptance criteria pass.

### Slice R12 — Cleanup + port-to-claudebase prep
- Code-review the Rust crate (`refactor-cleaner`-style sweep).
- Verify NOTICE + LICENSE files are accurate.
- Generate `docs/telegram-rust-architecture.md` describing the crate for
  someone who never read the TSX original.
- **Done when:** crate is reviewable as a standalone deliverable. This unlocks
  the parent-plan Phase 2 (move to claudebase repo) — the Rust crate goes
  alongside the TSX reference in claudebase/plugins/telegram-rs/.

## Risks

| Risk | Mitigation |
|---|---|
| MCP wire format drift between TSX and Rust | Slice R4: capture TSX trace, diff Rust output byte-for-byte. Reject anything other than bit-exact match. |
| `frankenstein` semantic mismatch with `grammy` (event types, callback shapes) | Per-event smoke test in Slice R3 + R7 (each type tested independently). |
| Rust binary fails to load — silent CC plugin error | Toggle defaults to TSX; missing `server-rs` falls back to TSX even with env var set. Operator can always disable Rust by `unset TELEGRAM_USE_RUST_SERVER`. |
| Whisper subprocess hangs forever | Port TSX timeout (120s for whisper, 30s for ffmpeg) via `tokio::time::timeout`. |
| Apache-2.0 attribution missed | LICENSE + NOTICE committed in Slice R1. README references upstream commit SHA `3449c10cd1f254c2529a4a7e96a094ef118a00a5` of `anthropics/claude-plugins-official`. |
| Cargo compile takes 10+ min and breaks iteration speed | Slice R1 minimal deps only (`tokio`, `serde`); add heavy deps later. Use `cargo check` for fast iteration. |
| Two pollers fight for TG token slot (Rust + leftover TSX bun process) | Slice R3 ports PID-file stale eviction. Test: kill old `bun server.ts`, start Rust, no 409. |

## Acceptance (overall)

All 7 acceptance items from the parent plan
[`telegram-tsx-to-rust.md`](./telegram-tsx-to-rust.md) Phase 1 + 1.5 PASS
when running the Rust binary with `TELEGRAM_USE_RUST_SERVER=1` set:

1. Plugin v0.0.6 installed (TSX-side, untouched)
2. Bot token + access.json + approved/ shared between TSX and Rust
3. Bot polling alive — Rust process
4. Channel callback received (text DM)
5. Reply round-trip — `mcp__telegram__reply` from Mira → user sees it
6. Voice transcription — `[voice transcription] <text>` in notification
7. Permission-request flow — inline buttons in TG, decision flows back

Slice R11 is the gate: all 7 pass = flip default + this plan's `Status:` → `complete`.

## Out of scope

- Porting to claudebase repo — that's parent-plan Phase 2, deferred until R12.
- Refactoring `claudebase/src/daemon/telegram.rs` (the failed daemon-based
  attempt) — separate decision, not blocking this work.
- Whisper via `whisper-rs` FFI crate instead of subprocess — possible v2
  improvement, not blocking parity.
- Group chat features beyond what TSX supports.

## Facts

### Verified facts
- `claudebase/src/plugin/mcp.rs` exists (12860 bytes) — reusable MCP JSON-RPC patterns — verified via `ls` this session. Salience: high (saves authoring time on Slice R1).
- `claudebase/src/plugin/bridge.rs` exists (30266 bytes) — STDIO bridge patterns from prior dual-process attempt — verified via `ls` this session. Reference only; the daemon-coupling parts must be discarded. Salience: medium.
- TSX upstream is at commit SHA `3449c10cd1f254c2529a4a7e96a094ef118a00a5` per `installed_plugins.json` — verified this session. Salience: high — required for NOTICE.
- Apache-2.0 license — verified in TSX `package.json` line 4 this session. Required for NOTICE compliance. Salience: high.
- Whisper binaries + model already present locally: `/opt/homebrew/bin/{ffmpeg,whisper-cli}`, `~/.local/share/whisper-cpp/models/ggml-medium.bin` (1.5 GB) — verified this session. Salience: medium (means Slice R9 doesn't need to test the auto-install path on this machine first).
- Phase 1 + 1.5 TSX baseline currently works end-to-end — verified by live `<channel ...>` callbacks received this session ("раз раз" message_id=419, voice transcription message_id=435). Salience: high (this is the regression baseline R11 must match).

### External contracts
- `frankenstein` crate — symbol: `AsyncApi::new(token)`, `AsyncApi::get_updates_async`, `AsyncApi::send_message_async`, `AsyncApi::edit_message_text_async`, `AsyncApi::set_message_reaction_async`, `AsyncApi::get_file_async`, `Message`, `Update` — source: docs.rs/frankenstein — verified: no — assumption. **Action item:** verify exact API surface in Slice R3 before committing to the crate; if `frankenstein` lacks a needed method, switch to `teloxide`. Salience: high.
- `tokio` v1.x — symbol: `#[tokio::main]`, `tokio::time::timeout`, `tokio::process::Command` — source: tokio docs (well-known) — verified: yes (standard idioms). Salience: medium.
- `serde_json::Value` — symbol: standard. — verified: yes. Salience: low.
- MCP JSON-RPC 2.0 — symbol: `initialize` returns `{protocolVersion, serverInfo, capabilities}`; `tools/list` returns `{tools: [{name, description, inputSchema}]}`; `tools/call` returns `{content: [{type: "text", text: "..."}]}`; notifications use method `notifications/claude/channel/*` (no id field) — source: TSX `server.ts:382-643` direct reading this session + spec at https://spec.modelcontextprotocol.io/ — verified: yes. Salience: high.
- Telegram Bot API — symbol: `getUpdates` long-polling (single-consumer-per-token, 409 Conflict if two), `sendMessage`, `editMessageText`, `setMessageReaction`, `getFile`, `sendChatAction(typing)`, `answerCallbackQuery` — source: TSX usage in `server.ts` — verified: yes (TSX exercises them all). Salience: high.
- Apache License 2.0 — symbol: requires LICENSE verbatim + NOTICE with attribution + preservation of copyright in source files. — verified: yes (standard). Salience: high.

### Assumptions
- `frankenstein` covers all 8 inbound message types TSX handles. **How to verify:** Slice R3 smoke test text + Slice R7 per-type tests. Salience: high.
- The MCP wire format CC expects for channel notifications is what TSX emits today. **How to verify:** Slice R4 — capture TSX trace + diff Rust output. Salience: high.
- The plugin supervisor in CC re-spawns the plugin process on first MCP tool call (or `/reload-plugins`). Confirmed by Phase 1 + 1.5 observations this session. Salience: medium.
- `bash -c "if ... then exec ... else exec ... fi"` in `.mcp.json` is portable enough — works on macOS + Linux; Windows uses different shell. **How to verify:** Slice R2. If Windows needs different toggle, document. Salience: low.

### Open questions
- Should we use `whisper-rs` (Rust FFI to whisper.cpp library) instead of shelling out to `whisper-cli` binary? Out of scope per "Out of scope" section above; revisit if subprocess approach proves unstable. Salience: low.
- For Slice R12, does the Rust crate move to claudebase as its own crate or as part of an existing one? Defer to Slice R12. Salience: low.

## Decisions

### Inbound validation
- Operator override accepted: "написать раст версию ... прямо в локальной папке ... затем поднимем вместо официального". Pushed back on (a) writing in cache vs repo, (b) destructive cutover. Operator accepted both push-backs ("меня устраивает этот план"). Outcome: proceed with safe-cutover approach in repo. Salience: high.

### Decisions made
- **Decision:** Write Rust in `claude-code-sdlc/telegram-plugin-rs/` (this repo), not in `~/.claude/plugins/cache/...` or in `claudebase/`. Alternatives rejected: cache (no git, destructive), claudebase (premature — this is exploratory work that will move there at R12). Q1-Q5: not a hack ✓ / proportionate ✓ / alternatives evaluated ✓ / addresses root cause (git history + reversibility) ✓ / n/a (no symptom-only) ✓. Salience: high.
- **Decision:** Toggle via `TELEGRAM_USE_RUST_SERVER=1` env var in patched `.mcp.json`, default = TSX. Alternative considered: separate plugin slug (`telegram-rs@claudebase-dev`). Rejected: forces user to manage two plugin installs; toggle is simpler. Salience: high.
- **Decision:** Use `frankenstein` crate over `teloxide`. Rationale: simpler API (1:1 with Telegram Bot API), lower compile cost, less magic, easier to port from grammy's similar style. Risk: smaller ecosystem; mitigated by R3 verification with switch-to-teloxide as fallback if it doesn't cover what we need. Salience: high.
- **Decision:** Whisper via subprocess (`std::process::Command`) not FFI (`whisper-rs` crate). Rationale: matches TSX strategy for parity; FFI adds compile complexity; subprocess is proven by TSX in Phase 1.5. Salience: medium.
- **Decision:** No git commits during slices unless operator says so. Per [feedback memory](../../../.claude/projects/-Users-aleksandra-Documents-claude-code-sdlc/memory/feedback_no_commit_without_signal.md). Salience: high.

### Hacks acknowledged
- **Hack:** `.mcp.json` uses `bash -c "if … then exec … else exec …"` — not portable to Windows. Removal path: in Slice R12 cleanup, generate platform-specific `.mcp.json` via install step or document Windows alternative. Salience: low (current operator is on macOS; cross-platform is a future concern).

### Symptom-only patches
(none) — this plan addresses root design (replace bun runtime with native Rust binary) rather than patching TSX.
