# Use Cases: Run to Completion

> Based on [PRD](../PRD.md) — Section 16: Run to Completion

---

**System context (do not assume otherwise):** this feature has no UI, no server and no database (PRD 16.6-16.8). It is a change to `hooks/handlers/stop-gate-evidence.js` (a second check inside an existing hook id), a new `hooks/lib/continuation.js`, a parser moved into `hooks/lib/scratchpad-state.js`, a legacy-file warning in `hooks/handlers/session-start-spine.js`, and instruction text in `src/claude.md`, `src/rules/error-recovery.md`, `src/rules/scratchpad.md`, `skills/implement-slice`, `skills/develop-feature` and `skills/bootstrap-feature`.

**Actors:**
- **Orchestrator** — the main-thread session running the pipeline (via `/develop-feature`, or unprefixed after plan approval / "work autonomously").
- **Developer** — the human who approved the plan and is not at the keyboard.
- **`stop:gate-evidence`** — the Stop hook; now runs the MERGE READY evidence check and the run-to-completion check.
- **`session:start:spine`** — the SessionStart hook; now also names legacy stop-inducing project files.

**The organizing principle:** every flow ends in a mechanically checkable outcome — a `decision: block` with a named slice, an allow (no decision), a fixed `systemMessage`, or a fixed warning line — which is what `docs/qa/run-to-completion_test_cases.md` pins.

---

## UC-1: Orchestrator Tries to Stop Between Slices — Refused, Continues

**Actor**: Orchestrator
**Preconditions**: scratchpad `## Status: implementing slice 3/7`; Slices 1-2 checked, `- [ ] Slice 3` pending; `## Blockers` is `(none)`; this session edited the scratchpad earlier.

**Primary Flow**:
1. The orchestrator commits Slice 2 and writes a report ending "Continuing to Slice 3" — but ends its turn.
2. `stop:gate-evidence` runs: no MERGE READY claim, so the evidence check is silent.
3. The continuation check reads the scratchpad: implementing, Slice 3 pending, no blocker, session engaged.
4. It records the progress key and returns a deny; the wrapper emits `decision: block`.
5. **Outcome**: the reason names "Slice 3 of 7" and the remedy; the model takes another turn and starts Slice 3.

**Alternative Flows**:
- **UC-1-A1: Engaged via a skill call** — the session never edited the scratchpad but called `Skill` with `claude-code-sdlc:implement-slice` → same block.
- **UC-1-A2: Engaged via a slash command** — the user's first message carries `<command-name>/develop-feature` → same block.
- **UC-1-A3: Wave path** — status `implementing wave 2 slice 4/8` → same block, naming Slice 4.

---

## UC-2: Legitimate Stop — a Recorded Blocker

**Actor**: Orchestrator, Developer
**Preconditions**: as UC-1, but Slice 3 needs a decision the plan did not make (Rule 4).

**Primary Flow**:
1. The orchestrator writes the decision under `## Blockers` and sets `## Status: blocked`, then presents the options.
2. `stop:gate-evidence` runs; status is `blocked` → no decision.
3. **Outcome**: the turn ends; the developer finds one recorded blocker.

**Alternative Flows**:
- **UC-2-A1: User asked to pause** — status `paused` → allowed.
- **UC-2-A2: Blocker recorded, status still implementing** — a non-empty `## Blockers` alone → allowed.
- **UC-2-A3: Retry budget exhausted / all-failed wave / architecture rejected twice** — each rule now records `## Blockers` + `blocked` first → allowed.

---

## UC-3: Planned Migration Is Not a Stop

**Actor**: Orchestrator
**Preconditions**: Slice 6's `Changes:` specify a schema migration; the PRD and architecture review approved it.

**Primary Flow**:
1. The orchestrator reaches Slice 6. Rule 4 now reads "…that the approved plan did not already make".
2. It implements the migration under TDD like any other slice.
3. **Outcome**: no stop at Slice 6.

**Alternative Flow**:
- **UC-3-A1: The plan got it wrong** — the migration as planned cannot work → a genuine Rule 4: `## Blockers` + `blocked` (UC-2).

---

## UC-4: Partial Wave Failure — Policy, Not a Question

**Actor**: Orchestrator
**Preconditions**: Wave 2 has Slices 3-5; Slice 4 fails.

**Primary Flow**:
1. Slices 3 and 5 are kept; Slice 4 is retried once with a fresh budget.
2. Still failing; no later slice's `Files:` depends on Slice 4 → the orchestrator marks it `FAILED` in `## Plan` and proceeds to Wave 3.
3. **Outcome**: no question asked; the final report lists Slice 4 as FAILED.

**Alternative Flows**:
- **UC-4-A1: A later slice depends on it** → `## Blockers` + `blocked` (UC-2).
- **UC-4-A2: All failed** → `## Blockers` + `blocked`.

---

## UC-5: No Progress — the Hook Lets Go

**Actor**: Orchestrator, `stop:gate-evidence`
**Preconditions**: as UC-1.

**Primary Flow**:
1. The model is blocked, answers without doing work, and tries to stop again: same status, same next slice, same checked count, same HEAD.
2. Second block on the unchanged key.
3. Third Stop on the unchanged key → no block; fixed `systemMessage` saying no progress was made and asking for the blocker to be recorded.
4. **Outcome**: the session is never wedged.

**Alternative Flow**:
- **UC-5-A1: Progress between blocks** — a new commit or a newly checked slice changes the key → the count restarts at 1 and the block applies again.

---

## UC-6: Stale Scratchpad, Unrelated Session

**Actor**: Developer
**Preconditions**: an abandoned feature left `implementing slice 2/6` in the scratchpad; today's session only answers a question and never touches the pipeline.

**Primary Flow**:
1. The session reads files and answers; it never edits the scratchpad, calls a pipeline skill or uses a pipeline command.
2. `stop:gate-evidence` → not engaged → no decision.
3. **Outcome**: unrelated work is never hijacked.

---

## UC-7: Quality Gates Unfinished

**Actor**: Orchestrator
**Preconditions**: all slices checked; status `quality-gates`.

**Primary Flow**:
1. The model ends a turn after Gate 3 without a verdict → block: finish `/merge-ready` and report its verdict.
2. After the verdict (MERGE READY or NOT MERGE READY) → allowed.

---

## UC-8: Docs-Only Bootstrap

**Actor**: Developer
**Preconditions**: the developer invokes `/bootstrap-feature` alone, asking only for documentation.

**Primary Flow**:
1. Step 7 initializes the scratchpad and, because the request was docs-only, sets `## Status: paused`.
2. **Outcome**: the turn ends after the documents; no forced implementation.

**Alternative Flow**:
- **UC-8-A1: Bootstrap as step 1 of a full run** — status `implementing … slice 1/N` and the orchestrator goes straight into Slice 1; a stop there is UC-1.

---

## UC-9: Legacy Project Files

**Actor**: `session:start:spine`, Developer
**Preconditions**: the project carries a pre-plugin `.claude/commands/implement-slice.md`, or a `.claude/claude.md` containing "Continue with next slice".

**Primary Flow**:
1. The session starts; the spine finds the file(s).
2. **Outcome**: a fixed-literal warning line naming the file and saying to delete it (commands) or remove the line (claude.md). Nothing is deleted.

**Alternative Flow**:
- **UC-9-A1: No legacy files** → no warning line.

---

## UC-10: Escapes and Fail-Open

- **UC-10-A1:** `SDLC_ALLOW_MIDPLAN_STOP=1` → the continuation check never blocks.
- **UC-10-A2:** `SDLC_ALLOW_UNEVIDENCED_GATES=1` → the MERGE READY evidence check is bypassed, but the continuation check still runs.
- **UC-10-A3:** scratchpad absent, a symlink, unreadable, or the transcript malformed → no decision.
- **UC-10-A4:** the counter cannot be persisted → a warning `systemMessage`, never a block.
