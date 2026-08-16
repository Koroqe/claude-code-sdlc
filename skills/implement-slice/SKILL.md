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

### 5. Commit
- `git add` specific changed files (not `git add -A`)
- `git commit -m "<type>(<scope>): <slice summary>"`
- Types: `feat`, `fix`, `test`, `chore`
- Scopes: `api | ui | db | auth | core | infra`

### 6. Write Changelog Entry

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

### 7. Update Scratchpad
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

### Git
- Branch: [branch name]
- Commit: [hash] — [message]

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
