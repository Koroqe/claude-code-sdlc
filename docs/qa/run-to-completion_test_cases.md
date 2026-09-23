# Test Cases: Run to Completion

> Based on [PRD](../PRD.md) — Section 16 and [Use Cases](../use-cases/run-to-completion_use_cases.md)

---

## 1. Testing Approach and Test-Kind Classification

Two kinds, as in the other feature documents:

- **STATIC** — hermetic hook-unit tests driven through `hooks/lib/run-hook.js` with a crafted stdin payload, a seeded project directory and a seeded transcript JSONL, plus CI validators. Zero LLM invocation. Run by `node tests/hooks/run-tests.js` and `node scripts/ci/ci-parity.js`.
- **BEHAVIORAL** — a live, unattended pipeline run. Costs real tokens; runs outside CI (like `scripts/eval/`). Specified precisely enough to execute as written.

Common fixture: a project root containing `.claude/scratchpad.md` and a transcript file. "Engaged" means the transcript holds a main-thread assistant `tool_use` `Edit` of `.claude/scratchpad.md` unless the case says otherwise. "Blocks" means stdout carries `decision: "block"`; "allows" means no `decision` field.

---

## 2. Continuation Check (FR-1, FR-4)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-2.1 | UC-1, AC-1 | STATIC | `implementing slice 3/7`, Slices 1-2 `[x]`, `- [ ] Slice 3`, Blockers `(none)`, engaged | Blocks; reason contains `Slice 3 of 7` and `SDLC_ALLOW_MIDPLAN_STOP` |
| TC-2.2 | UC-1-A3 | STATIC | `implementing wave 2 slice 4/8`, first unchecked is Slice 4 | Blocks; reason names Slice 4 |
| TC-2.3 | UC-2, AC-2 | STATIC | as TC-2.1 but `## Status: blocked` + a Blockers line | Allows |
| TC-2.4 | UC-2-A1, AC-2 | STATIC | as TC-2.1 but `## Status: paused` | Allows |
| TC-2.5 | AC-2 | STATIC | `## Status: complete`, all slices `[x]` | Allows |
| TC-2.6 | UC-2-A2 | STATIC | as TC-2.1 but Blockers holds a real line | Allows |
| TC-2.7 | FR-1 | STATIC | Blockers holds each none-marker in turn: `(none)`, `none`, `- none`, `n/a` | Blocks for each |
| TC-2.8 | FR-1 | STATIC | pending slice exists only below `## Archive` | Allows |
| TC-2.9 | FR-4 | STATIC | Feature name in scratchpad is a hostile string | Reason contains no scratchpad free text |

## 3. Engagement (FR-2)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-3.1 | UC-6, AC-3 | STATIC | as TC-2.1 but transcript has no engagement signal | Allows |
| TC-3.2 | UC-1-A1 | STATIC | engagement only via `Skill` tool_use `claude-code-sdlc:implement-slice` | Blocks |
| TC-3.3 | UC-1-A2 | STATIC | engagement only via user record `<command-name>/develop-feature` | Blocks |
| TC-3.4 | FR-2 | STATIC | scratchpad Edit appears only in a sidechain (`isSidechain: true`) record | Allows |
| TC-3.5 | FR-2 | STATIC | Windows-style `file_path` with backslashes ending `.claude\scratchpad.md` | Blocks |

## 4. Progress Bound (FR-3)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-4.1 | UC-5, AC-4 | STATIC | three consecutive Stops, same session, unchanged scratchpad and HEAD | Blocks, blocks, then allows with the fixed no-progress `systemMessage` |
| TC-4.2 | UC-5-A1, AC-4 | STATIC | two blocks, then Slice 3 checked | Next Stop blocks again (count restarts) |
| TC-4.3 | FR-3 | STATIC | counter directory unwritable | Allows with a warning `systemMessage`; never blocks |

## 5. Quality Gates (FR-1)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-5.1 | UC-7, AC-5 | STATIC | `quality-gates`, last main text has no verdict | Blocks |
| TC-5.2 | UC-7, AC-5 | STATIC | `quality-gates`, last main text contains `NOT MERGE READY` | Allows |
| TC-5.3 | UC-7, AC-5 | STATIC | `quality-gates`, last main text reports MERGE READY, a subagent ran | Allows |

## 6. Existing Evidence Check and Escapes (FR-5, FR-6)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-6.1 | AC-6 | STATIC | MERGE READY claimed, no subagent in transcript | Blocks with the unchanged evidence reason |
| TC-6.2 | AC-6 | STATIC | `SDLC_ALLOW_UNEVIDENCED_GATES=1` + TC-2.1 setup | Blocks with the continuation reason |
| TC-6.3 | UC-10-A1 | STATIC | `SDLC_ALLOW_MIDPLAN_STOP=1` + TC-2.1 setup | Allows |
| TC-6.4 | UC-10-A3 | STATIC | scratchpad absent; scratchpad a symlink (skipped where symlinks cannot be made); malformed transcript lines | Allows in each |

## 7. Self-Resolvability (AC-7)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-7.1 | AC-7 | STATIC | `tests/hooks/test-autonomy-regression.js`: TC-2.1 blocks; then write a Blockers line and `## Status: blocked` as the reason instructs | The next Stop allows — the remedy needs no human |

## 8. Legacy Warning (FR-8)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-8.1 | UC-9, AC-8 | STATIC | `.claude/commands/implement-slice.md` present | Spine output contains the legacy-file warning naming that path |
| TC-8.2 | UC-9 | STATIC | `.claude/claude.md` contains `Continue with next slice?` | Spine output contains the legacy-instruction warning |
| TC-8.3 | UC-9-A1 | STATIC | neither present | No legacy line |
| TC-8.4 | FR-7 | STATIC | scratchpad `## Status: paused` | Spine reports status `paused`, not `unrecognized` |

## 9. Instruction Text and Budgets (FR-9, NFR-1, NFR-2)

| ID | Covers | Kind | Setup | Expected |
|---|---|---|---|---|
| TC-9.1 | NFR-2 | STATIC | `node scripts/ci/validate-context-budget.js` | PASS with no ceiling raised |
| TC-9.2 | NFR-1 | STATIC | `hooks/hooks.json` hook ids; `tests/hooks/test-guards-cross.js` | Still 12 ids |
| TC-9.3 | FR-9 | STATIC | grep shipped text for `Continue with next slice`, `ask user: retry / continue / abort`, `one iteration` | No matches in `skills/`, `src/` |
| TC-9.4 | FR-9 | STATIC | `node scripts/ci/validate-triage-parity.js` | PASS (Phase 0 text untouched) |

## 10. Live Runs (AC-9)

| ID | Covers | Kind | Procedure | Expected |
|---|---|---|---|---|
| TC-10.1 | AC-9 | BEHAVIORAL | Throwaway project with the updated plugin. `/develop-feature` a feature whose plan has ≥7 slices including one planned migration. Walk away. | All slices committed; `/merge-ready` verdict reported; zero human messages in the transcript after the first |
| TC-10.2 | AC-9 | BEHAVIORAL | Same, but the request is unprefixed: "build X, work autonomously" | Same outcome |
| TC-10.3 | UC-2 | BEHAVIORAL | Seed an unplanned blocker (a slice that requires an unlisted dependency) | Run ends with `## Status: blocked` + a Blockers entry; the hook does not loop |
