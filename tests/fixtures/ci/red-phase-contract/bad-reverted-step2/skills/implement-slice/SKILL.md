---
description: Implement the next smallest slice from the current plan using TDD — tests first, then code, then verification, then an atomic commit. Reads the plan from the scratchpad.
argument-hint: "[slice number] [no-changelog]"
arguments: [slice]
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Agent, TodoWrite
---

# Command: Implement Slice

Implement only the next smallest slice from the plan using TDD.

## Arguments

`$slice` (also available as `$ARGUMENTS`) optionally names the slice to implement. When empty, take the next pending slice from `.claude/scratchpad.md`.

**Literal-token flag rule:** a documented flag is active ONLY if its literal token appears in `$ARGUMENTS`. In particular, the `no-changelog` suppression flag is in effect ONLY when the literal token `no-changelog` was passed. Never infer it from context, and never assume it because the documentation describes it.

## Pre-flight Checks

1. Confirm you are NOT on `main` — must be on a feature branch (`feat/*` or `fix/*`)
2. Confirm `git status` is clean (or explain why not)
3. **Parallel subagent mode:** when running as a subagent within a parallel wave (wave context provided in spawn prompt), the following rules apply for the entire execution:
   - Do NOT write to `.claude/scratchpad.md` — the orchestrator handles scratchpad updates
   - Do NOT write to `.claude/instincts.md` — it is `PROTECTED` identically to the scratchpad (Section 8 FR-7.2). Track deviation-rule tallies and the build-runner attempts counter in-context instead, and report them to the orchestrator for it to persist (see Step 6, Capture Instincts)
   - Do NOT auto-continue to the next slice — return to the orchestrator after committing
   - Chain git commands: `git add <files> && git commit -m '...'` as a single Bash command to prevent staging conflicts with sibling subagents
4. **Tier-aware documentation check:** confirm these documentation files exist — **skipped entirely
   when `.claude/scratchpad.md` reads `## Tier: quick`**, since neither file is ever required for a
   `quick`-tier change, by design (FR-4.4). This check runs unmodified — exactly as written below —
   when `## Tier:` reads `full` or the field is absent: absence means `full` is the
   backward-compatibility default for every scratchpad written before this tier field existed, so an
   absent field is never read as license to skip this check.
   - `docs/qa/<feature>_test_cases.md` — if not, delegate to `qa-planner` first
   - `docs/use-cases/<feature>_use_cases.md` — if not, delegate to `ba-analyst` first
5. **Tracer gate:** read the plan file and check whether any slice is marked `**Tracer:** yes`.
   - **If a `**Tracer:** yes` slice exists** and this invocation targets a different (non-tracer) slice, AND the tracer slice's `Verify:` condition has not yet been run and passed: REFUSE. Do not proceed to Step 1 (Identify the Slice) or any TDD work. State plainly that the tracer slice must be implemented and its `Verify:` condition passed first, name the tracer slice, and instruct the caller to run `/implement-slice` against the tracer slice before retrying this one. This check exists because standalone invocation of this skill bypasses `/develop-feature`'s wave sequencing entirely — wave ordering alone cannot gate a direct, out-of-band `/implement-slice` call.
   **Source of truth for "the tracer passed":** the tracer slice's DONE record with a commit hash in
   `.claude/scratchpad.md`, or a fresh run of the tracer's own `Verify:` command. If neither is
   available, or the record is ambiguous, REFUSE — an unverifiable tracer is an unpassed tracer.
   - **If this invocation targets the tracer slice itself:** proceed normally — the tracer is exempt from its own gate.
   - **Exemption (backward compatibility), tier-aware wording (FR-4.5, AC-27):** if the plan carries no `**Tracer:** yes` marker anywhere, this check does not apply. Print the tier-appropriate line verbatim, then continue with the remaining pre-flight checks and TDD flow as normal — the exemption is never silent:
     - **When `.claude/scratchpad.md` reads `## Tier: quick`:** a marker-free plan here is `quick` tier's own single-slice plan, exempt from the tracer requirement by design — never a legacy plan. Print exactly:

       `tracer gate inactive — tier: quick, single-slice plan is exempt from the tracer requirement by design.`
     - **When `## Tier:` reads `full`, or the field is absent (the pre-F4 legacy case):** print the existing legacy wording, unchanged:

       `tracer gate inactive — no **Tracer:** yes marker found; treating as pre-F3 plan.`

## TDD Implementation Flow

### 1. Identify the Slice

Read the current slice from the implementation plan. Two formats are supported:

**Executable format** (preferred — when the slice has `Files:`, `Changes:`, `Verify:`, `Done when:` fields):
- Use the `Files:` list directly — these are the exact files to create/modify
- Use the `Changes:` descriptions as implementation guidance
- Use the `Verify:` commands in step 4
- Use the `Done when:` condition to confirm completion
- List the use-case scenarios this slice covers (from `Use cases:` field)
- Re-read each file from the `Files:` list before modifying

**Legacy format** (fallback — when the slice is prose without structured fields):
- Restate the next slice in 1 sentence
- List the use-case scenarios this slice covers (UC-X.Y, UC-X-A, etc.)
- Read existing files that will be modified

### 2. Write Tests First

**Quick-tier carve-out (FR-4.4, AC-26):** when `.claude/scratchpad.md` reads `## Tier: quick`, state
the following verbatim in the delegation prompt, before the request itself: "no
`docs/qa/<feature>_test_cases.md` file exists for this change by design and MUST NOT be treated as a missing input."
`test-writer` derives its tests from the slice's own `Verify:`/`Done when:` fields
instead. This carve-out lives in the delegation prompt only — `agents/test-writer.md` itself is never
modified by this instruction.

Delegate to `test-writer` agent:
- Reference documented test cases from `docs/qa/` (for a `quick`-tier run, this reference is replaced
  by the carve-out above, since no such file exists by design)
- Reference use-case scenarios from `docs/use-cases/` for this slice (for a `quick`-tier run, use the
  slice's own `Use cases:` field if present, since no use-cases file exists by design)
- Write tests for this slice's behavior using the project's test framework
- Tests should FAIL initially (no implementation yet)

### 3. Implement Code
- Before editing each file: re-read it from disk (do NOT rely on earlier in-context reads — context compaction may have made them stale)
- Make minimal changes to pass the tests
- Follow the project structure as defined in CLAUDE.md
- Keep route handlers thin, business logic in services/data layer
- If this slice edits 4+ files: run the project's typecheck command after every 3 file edits before continuing (per error-recovery rules)

### 4. Verify

**If the slice has a `Verify:` field:** run the exact command(s) from that field first. Then delegate to `build-runner` for full verification (typecheck, tests, build).

**If the slice has a `Done when:` field:** after verification passes, confirm the done-condition is satisfied (e.g., run the grep, check the endpoint, verify the file exists). If the done-condition is not met, the slice is not complete — investigate and fix.

**If the slice has a `Verify:` field with "Manual verification:":** report the check instructions in the output so the developer can verify manually.

**Fallback (no structured fields):** delegate to `build-runner` agent to run the project's typecheck, test, and build commands (from CLAUDE.md).

**Persisted build-runner attempts counter and `debugger` auto-invocation (FR-8.5, C8/FR-8.10).** The 3-retry budget `src/rules/error-recovery.md` already governs is not tracked in conversation memory alone here either — mirroring `/merge-ready`'s `Gate 6 attempts: N/3` precedent exactly:

- **Standalone path (no wave context):** after every `build-runner` invocation for this slice (the initial run and each retry), write `Slice <N> build-runner attempts: N/3` under the feature's current status in `.claude/scratchpad.md` via **`Edit`, never a whole-file `Write`**. Before deciding whether to retry, **read this line back from the file** — never rely on what you recall having written earlier in the conversation. When the counter reaches **`2/3`** with `build-runner` still FAILing, self-invoke the `debugger` agent — feeding it the prior failure output(s) and the feature slug — BEFORE the 3rd (final) retry attempt. Apply `debugger`'s recommended fix under whichever deviation rule it names; if `debugger` returns `UNDIAGNOSED`, the final attempt proceeds exactly as it would have without this feature.
- **Wave-subagent path (wave context provided):** `.claude/scratchpad.md` is `PROTECTED` — do NOT write it. Track `Slice <N> build-runner attempts: N/3` **in-context** for the duration of this slice instead, self-invoke `debugger` at `2/3` identically to the standalone path, and report the final attempts count to the orchestrator (Step 6, Capture Instincts) for it to persist.
- **C8/FR-8.10 inline fallback:** both paths above assume `debugger` can be reached via the `Agent` tool. If nested agent spawn is unavailable in the running context, do NOT skip the diagnostic pass — run `debugger`'s bounded scientific-method protocol (`agents/debugger.md` Process: up to 5 falsifiable hypothesis cycles) **inline**, in this same context, instead of spawning it. The `UNDIAGNOSED` verdict and the final-attempt escalation path are unchanged either way. A diagnosis that cannot run degrades to a slower, inline diagnosis — never to silence.

### 5. Commit
- `git add` specific changed files (not `git add -A`)
- `git commit -m "<type>(<scope>): <slice summary>"`
- Types: `feat`, `fix`, `test`, `chore`
- Scopes: `api | ui | db | auth | core | infra`

### 6. Capture Instincts

This step runs **after the commit step** (5), occupying the same post-commit position pattern the changelog step (7, below) occupies. Unlike the changelog step, it is never suppressed by the `no-changelog` flag — that flag governs only `CHANGELOG.md`; the instinct store has its own, separate gating (the wave-subagent carve-out below).

**Trigger 1 — User Correction (FR-2.1).** Scan the conversation since this slice began for exactly these three heuristics:
(a) explicit rejection language ("that's wrong," "no, you should," "revert that," "undo that," or equivalent);
(b) the developer supplies replacement code or a replacement approach directly;
(c) the developer references a prior state or explicitly asks to go back.
A match against any of the three captures (or updates, per the dedup scan below) one instinct entry with `Trigger: User Correction`. **A non-match writes nothing** — never force a capture when none of the three heuristics fired.

**Trigger 2 — Repeated Deviation Rule (FR-2.2).** Maintain a single per-feature tally line in `.claude/scratchpad.md`:

```
Deviation rule fires this feature: rule1=<n> rule2=<n> rule3=<n> rule4=<n>
```

- Every time a deviation rule (`src/rules/error-recovery.md`, Rules 1–4) fires during this feature's implementation — across every slice, not only this one — increment that rule's count via **`Edit`, never a whole-file `Write`**.
- **Before deciding whether the threshold is met, read the line back from the file** — never rely on an in-context recollection of what was written earlier in the conversation; this is what survives a context compaction.
- When a given rule's count reaches **2 or more**, capture (or update) one instinct with `Trigger: Repeated Deviation Rule`, describing the recurring error pattern.
- **Rule 1 and Rule 2 fires count identically to Rule 3 and Rule 4 fires.** Rule 1/2 fixes are "free" — they consume no retry budget and are therefore invisible in any retry count — which is exactly why this tally must track them explicitly rather than deriving the signal from retries.
- Standalone path: update the tally directly via `Edit` as each rule fires, on this slice's own turn.
- Wave-subagent path: see the carve-out below — the tally is tracked in-context here, never written to the file.

**Entry schema — the full 8 fields (FR-1.4), minted within D1's allowlist.** Every captured or updated entry is a `### <slug>` heading (kebab-case, ≤60 characters — the mechanical dedup key) followed by:

- `Confidence:` — `min(0.9, 0.3 + 0.2 × (occurrences − 1))`, recomputed ONLY at a new-occurrence event (a fresh feature slug added to `(features: ...)`), overwriting any prior decay.
- `Category:` — see the FR-1.7 rules below.
- `Pattern:` — the file path or glob the instinct concerns.
- `Rule:` — a single-line ALWAYS/NEVER/WHEN prevention heuristic, generalized beyond the specific instance that produced it, minted within **D1's allowlist**: `/^[\p{L}\p{N} ._/():+#&',—-]{1,200}$/u`, 1–200 characters, a single physical line. A candidate `Rule:` that fails D1 is never written raw or truncated into shape — regenerate it within the allowlist before capturing; D1 is the one shared definition this step and the session-start injection hook both validate against.
- `Trigger:` — `User Correction` or `Repeated Deviation Rule` (the two triggers this step owns; `Gate Auto-Fix`/`Gate Retry Exhausted` belong to `/merge-ready`'s own capture step).
- `Occurrences:` — an integer, followed by `(features: <slug1>, <slug2>, ...)`.
- `Last confirmed at:` — the `## Meta` `Feature counter` value, stamped per the dedup rule below.
- `Retires at:` — `Last confirmed at` + 10.

**Category assignment — FR-1.7 in full:**
- `Category: security` when the capturing gate is Gate 3 (Security Audit) **OR** `Pattern:` hits `auth`, `payment`, `billing`, or `secret` as a path segment (case-insensitive), **OR** `Pattern:` is `.github/workflows/`, `install.sh`, or `.claude/settings.json`.
- `Category: data-integrity` when `Pattern:` contains `migration` as a path segment, **OR** the capturing context is a data-mutation or financial code path.
- `Category: general` otherwise — the conservative default; `general` entries require one more occurrence to elevate than `security`/`data-integrity` entries.

**C3/FR-1.5a pre-capture dedup scan — MANDATORY.** Before minting any new `### <slug>` heading, scan **both** `## Prevention Rules` and `## Instincts Log` for an existing entry whose `Pattern:` **and** `Category:` both match the pattern about to be captured (case-insensitive). A match is a **recapture of that existing heading — never a new one**: update the matched entry in place instead of minting a new slug.
- A recapture within the **same feature** (the feature slug already present in that entry's `(features: ...)` list) does **NOT** increment `Occurrences:` a second time.
- On any capture (new or recapture), stamp `Last confirmed at` with the counter's **pre-increment** value — the `## Meta` `Feature counter` as it reads right now, before `/merge-ready` Finalization's own `+1` (FR-3.2) next runs.
- **This scan is not optional.** Skipping it lets a model-minted slug fragment the same pattern across near-duplicate headings (`missing-api-validation` vs. `api-input-validation-missing`) — occurrence counts never converge, nothing reaches the elevation threshold, nothing ever retires, and the store silently degrades into exactly the flat, append-only log this feature exists to replace, while every mechanism above still appears to be working.

**FR-1.2 lazy creation.** If a trigger above fires and `.claude/instincts.md` does not exist yet: `Write` it from the identical scaffold `templates/instincts.md` provides (three sections — `## Meta` with `Feature counter: 0`, `## Prevention Rules`, `## Instincts Log`, no pre-populated entries). This targets a nonexistent file, so it is outside `pre:write:shrink-guard`'s scope (that guard fires on `Write` to an *existing*, curated file — Section 8 FR-3). Then append the new entry via `Edit`. Only instructions that *read* the store need an existence guard (it may legitimately not exist yet); an instruction that only writes it never does.

**Wave-subagent carve-out.** When running as a parallel-wave subagent (wave context provided in spawn prompt), `.claude/instincts.md` and `.claude/scratchpad.md` are **both `PROTECTED`** (Section 8 FR-7.2) — do NOT write either file in this step.
- Track the Trigger 2 deviation-rule tally **and** the `Slice <N> build-runner attempts: N/3` counter (Step 4) **in-context** for the duration of this slice.
- Self-invoke `debugger` at `2/3` exactly as the standalone path does (Step 4) — this requires writing neither the store nor the scratchpad.
- In the result returned to the orchestrator, report: the detected Trigger 1 corrections (if any), the deviation-rule fires as **`(category, count)` pairs**, and the **final `Slice <N> build-runner attempts: N/3` count**. The orchestrator folds these into the feature-level tally and captures/persists any resulting instinct after collecting the whole wave's results (FR-2.4, FR-7.0) — mirroring the changelog step's own orchestrator-owns-the-write discipline.
- **Accepted residual, stated plainly:** a context compaction mid-subagent can lose the in-context tally or attempts count before either is ever reported. This is bounded by the subagent's own single-slice lifetime — worst case, one slice's signal is undercounted, never the whole feature's — and is an accepted residual, not a defect this slice closes.

**Standalone path (no wave context).** Apply Trigger 1 and Trigger 2 directly: `Edit` the tally line in `.claude/scratchpad.md`, read it back, and capture/update instinct entries in `.claude/instincts.md` per the schema, category rules, and dedup scan above.

### 7. Write Changelog Entry

This step runs **only after a successful commit** (step 5). It is the standalone-fix path: when a slice is committed outside the full pipeline, the changelog still needs an entry.

**Skip this step entirely when EITHER skip condition is true:**
- (a) **Parallel-wave subagent** — wave context was provided in the spawn prompt. The orchestrator / `merge-ready` owns the changelog entry for the wave.
- (b) **`no-changelog` suppression flag** — a `no-changelog` flag was passed (i.e. this run is driven by `/develop-feature`). `merge-ready` owns the entry for the whole feature.

If either condition holds, do NOTHING here — `merge-ready` writes the single consolidated entry.

**When BOTH skip conditions are false** (true standalone fix), write ONE entry to the project-root `CHANGELOG.md` following the changelog rule (`changelog.md`):
- Retrieve the real timestamp by running `date -u +'%Y-%m-%d %H:%M'` — NEVER invent or guess the timestamp.
- Fields: name, UTC time, a non-technical Summary, and Details (≤500 characters).
- Entries are day-grouped, newest-first.
- **Idempotency guard:** if an existing entry with the same name already exists under today's date, UPDATE that entry in place — do NOT duplicate it.

### 8. Update Scratchpad
**Skip this step when running as a parallel subagent** (wave context provided in spawn prompt). The orchestrator handles scratchpad updates after collecting all wave results.

**When running standalone** (no wave context), update `.claude/scratchpad.md` with:
- What changed
- Commit hash + message
- Use cases covered by this slice
- What's next (next slice)

## Rules

- Minimal diff — change only what's necessary for this slice
- 1 slice = 1 commit (atomic)
- No refactors unless required for this slice
- NEVER add "Co-Authored-By" or AI attribution to commits

## Output Format

```
## Slice: [description]
### Wave: [N — slice X of Y in this wave] (or "standalone — no wave context")

### Use Cases Covered
- UC-X.Y: [scenario name]
- UC-X-A: [alternative flow name]

### Tests Written
- [test file]: [number] test cases

### Implementation
- [files changed with brief description]

### Verification
- Typecheck: PASS/FAIL
- Tests: PASS/FAIL (X passed)
- Build: PASS/FAIL
- Slice <N> build-runner attempts: [n]/3 — debugger invoked: Yes (at 2/3) / No

### Git
- Branch: [branch name]
- Commit: [hash] — [message]

### Instincts
- Trigger 1 (User Correction) detected: Yes/No — [1-line description if Yes]
- Deviation-rule fires this slice, as (category, count) pairs: [list, or "none"]
- Store write: Yes (standalone) / Skipped (parallel-wave subagent — reported to orchestrator) / None (no trigger matched)

### Changelog
- Entry written: Yes / Skipped (parallel-wave subagent) / Skipped (no-changelog flag — develop-feature owns it)

### Next Slice
- [description of next slice]
```

## Auto-Continue

**When running as a parallel subagent** (wave context provided): do NOT auto-continue. Return your result (PASS with commit hash, or FAIL with error details) to the orchestrator. Wave progression is managed by develop-feature.

**When running standalone** (no wave context), after committing this slice, if there are remaining slices in the plan:
- Immediately proceed to the next slice
- Do NOT wait for user input
- Read `.claude/scratchpad.md` to identify the next slice
- Continue the TDD flow for the next slice
