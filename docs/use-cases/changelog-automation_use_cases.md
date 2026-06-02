# Use Cases: Changelog Automation

> Based on [PRD](../PRD.md) — Section 5: Changelog Automation

---

## UC-1: Merge-Ready Finalization Writes a Feature Entry

**Actor**: Claude executing `/merge-ready` after all quality gates PASS
**Preconditions**:
- The feature branch has at least one committed slice
- All quality gates (build, tests, code review, security audit, E2E, verifier, doc-updater) have reported PASS
- The command was invoked in a project at a known working-directory root
- A real shell is available (Bash `date -u` can execute)

**Trigger**: All numbered quality gates complete with PASS, causing the `/merge-ready` finalization section to execute

### Primary Flow (Happy Path)

1. The last quality gate reports PASS and the gate table is complete
2. The "Finalization: Changelog Entry" section begins (it is not a numbered gate and is excluded from the pass/fail table)
3. Claude runs `date -u +'%Y-%m-%d %H:%M'` via Bash to retrieve the real UTC timestamp; it does NOT invent or estimate the value
4. Claude checks whether `CHANGELOG.md` exists at the project root
5. `CHANGELOG.md` is absent — Claude creates it with the `# Changelog` header block followed by a blank line
6. Claude constructs the entry: `### <feature name> — <HH:MM> UTC` heading, `**Summary:**` one-liner (non-technical), `**Details:**` up to 500 characters
7. Claude applies the idempotency guard: searches for an existing `### <feature name>` entry under today's `## YYYY-MM-DD` heading — none found
8. Claude inserts a new `## YYYY-MM-DD` heading immediately after the `# Changelog` header block
9. Claude writes the entry as the first (and only) entry under that heading
10. Claude delegates the file write to `doc-updater`, referencing `src/rules/changelog.md` as the format authority
11. `/merge-ready` outputs confirmation that the changelog entry was written

**Postconditions**:
- `CHANGELOG.md` exists at project root with `# Changelog` header
- A `## YYYY-MM-DD` heading exists using today's real UTC date
- Exactly one `### <feature name> — HH:MM UTC` entry exists under that heading
- `**Summary:**` is a single non-technical line; `**Details:**` is ≤ 500 characters
- The timestamp matches real UTC (produced by `date -u`, not invented)
- The finalization section did not appear in the gate PASS/FAIL table

### Alternative Flows

- **UC-1-A1: CHANGELOG.md already exists** — the file was created by a prior merge-ready run or by `--init-project` scaffolding
  1. Steps 1–3 execute as above (real UTC timestamp retrieved)
  2. At step 4, `CHANGELOG.md` is found — Claude does NOT recreate or overwrite the header block
  3. Claude reads the existing file to locate the current day heading
  4. If a `## <today's date>` heading is already present (see UC-3), the new entry is prepended inside it
  5. If no `## <today's date>` heading exists (see UC-4), a new day heading is inserted above the previous day headings
  6. The `# Changelog` header block and all existing entries remain intact

- **UC-1-A2: Feature was taken through /develop-feature** — the complete pipeline ran; no slice wrote a changelog entry
  1. Each `/implement-slice` invocation during the feature received the `no-changelog` suppression flag from `/develop-feature`; none wrote an entry
  2. `/merge-ready` runs as the final step of `/develop-feature`
  3. The finalization section executes and writes exactly one entry for the entire feature (steps 1–11 above)
  4. The result is a single entry — not one entry per slice

**Postconditions**: Identical to the primary flow; no duplicate entries exist from any prior slice run.

### Error Flows

- **UC-1-E1: One or more quality gates FAIL — finalization is suppressed**
  1. The overall `/merge-ready` result is NOT MERGE READY (at least one gate FAILED)
  2. The "Finalization: Changelog Entry" section does NOT execute
  3. `CHANGELOG.md` is not modified
  4. The developer fixes the failure and reruns `/merge-ready`; the finalization will execute when all gates PASS

- **UC-1-E2: `date -u` Bash invocation is blocked or unavailable**
  1. Claude attempts to run `date -u +'%Y-%m-%d %H:%M'` via Bash
  2. The command fails or the output is empty
  3. Claude MUST NOT invent a timestamp; it reports the failure to the developer
  4. No entry is written to `CHANGELOG.md`
  5. The developer resolves the Bash availability issue and reruns `/merge-ready`

### Edge Cases

- **UC-1-EC1**: The finalization section executes correctly but `doc-updater` reports an error writing the file (e.g., permission denied). Claude surfaces the error in the `/merge-ready` output. The merge is not blocked — the changelog write failure is reported as a warning, not a gate failure.
- **UC-1-EC2**: The feature name contains special markdown characters (e.g., backticks or pipes). Claude sanitises the name in the `###` heading so it does not break the markdown structure.
- **UC-1-EC3**: The Details field that the developer or agent provides exceeds 500 characters. Claude trims it to exactly 500 characters before writing. The trim is performed silently (no error, no user prompt); the trimmed form is what appears in the file.

### Data Requirements

- **Input**: All quality gate results (PASS/FAIL); the feature name; a Summary and Details for the entry; real UTC timestamp from `date -u`
- **Output**: One new `### <name> — HH:MM UTC` entry written to `CHANGELOG.md`, grouped under the correct `## YYYY-MM-DD` heading
- **Side Effects**: `CHANGELOG.md` at project root is created (if absent) or updated (if present). No other files are modified by this step. The finalization section is invisible in the gate pass/fail table.

---

## UC-2: Standalone Implement-Slice Fix Writes an Entry

**Actor**: Claude executing a standalone `/implement-slice` invocation (not driven by `/develop-feature`, not a parallel-wave subagent)
**Preconditions**:
- The user invoked `/implement-slice` directly (not as part of a feature pipeline)
- No `no-changelog` suppression flag was passed in the invocation
- No wave context is present (this is not a parallel-wave subagent)
- The slice has been implemented, tests pass, and the commit has been made

**Trigger**: The commit step of `/implement-slice` completes successfully, advancing to the changelog step

### Primary Flow (Happy Path)

1. The slice implementation completes and the commit is made (the existing commit step)
2. The changelog step begins (it appears after the commit step and before the scratchpad update step)
3. Claude evaluates both skip conditions:
   - Is this a parallel-wave subagent? — No
   - Was a `no-changelog` flag passed? — No
4. Neither skip condition holds; the changelog step proceeds
5. Claude runs `date -u +'%Y-%m-%d %H:%M'` via Bash to retrieve the real UTC timestamp
6. Claude checks whether `CHANGELOG.md` exists at the project root
7. If absent, Claude creates it with the `# Changelog` header block
8. Claude applies the idempotency guard: searches for an existing entry with the same fix name under today's `## YYYY-MM-DD` heading — none found
9. Claude writes one entry under the correct day heading (creating or inserting as needed, per UC-3 and UC-4 logic)
10. The scratchpad update step executes as the next step

**Postconditions**:
- Exactly one changelog entry exists for this fix under today's `## YYYY-MM-DD` heading
- The timestamp is real UTC (from `date -u`)
- Summary is a single non-technical line; Details ≤ 500 characters
- The scratchpad was updated after the changelog step

### Alternative Flows

- **UC-2-A1: Standalone fix on a day that already has entries** — prior work was done earlier the same UTC day
  1. Steps 1–8 execute as above
  2. At step 9, a `## <today's date>` heading already exists with prior entries
  3. Claude prepends the new entry as the first entry under that heading (newest-first ordering)
  4. Prior entries are shifted down; they are not modified

- **UC-2-A2: Slice verification (Verify: command) fails before commit** — the fix is not committed
  1. The slice's `Verify:` command fails; the commit step does not execute
  2. The changelog step is never reached because it is conditioned on a successful commit
  3. No changelog entry is written
  4. Deviation rules govern the error; the changelog step executes only if the slice eventually commits successfully

### Error Flows

- **UC-2-E1: `no-changelog` flag is present (suppression active)**
  1. Claude evaluates the skip conditions at step 3
  2. The `no-changelog` flag is detected — this slice was driven by `/develop-feature`
  3. The changelog step is a no-op; no entry is written
  4. Control passes to the scratchpad update step
  5. The entry will be written by `/merge-ready` after quality gates pass

- **UC-2-E2: Parallel-wave subagent context is detected**
  1. Claude evaluates the skip conditions at step 3
  2. Wave context is present — this is a parallel-wave subagent
  3. The changelog step is a no-op; no entry is written
  4. The orchestrator (`/develop-feature`) handles all changelog writes for this wave after wave completion

### Edge Cases

- **UC-2-EC1**: The user runs `/implement-slice` directly but the slice is logically part of a larger feature they intend to gate with `/merge-ready` later. The standalone path fires and writes an entry. When `/merge-ready` later runs, the idempotency guard prevents a duplicate (see UC-E-IdempotencyGuard). The developer ends up with one entry from the standalone fix and one from merge-ready — this is the expected behavior if the user chose not to use `/develop-feature`.
- **UC-2-EC2**: The commit was made but the Bash shell exits before the changelog step executes (e.g., context compaction, session interruption). On the next session, re-running the changelog step manually or running `/merge-ready` will trigger the idempotency guard if an entry already exists.

### Data Requirements

- **Input**: Fix name; Summary and Details text; real UTC timestamp from `date -u`; current state of `CHANGELOG.md`
- **Output**: One new entry appended/inserted in `CHANGELOG.md`
- **Side Effects**: `CHANGELOG.md` created or updated. The commit is already on the branch before this step executes. Scratchpad is updated after this step.

---

## UC-3: New Entry Prepended Within an Existing Day Heading

**Actor**: Claude executing either the merge-ready finalization step or the standalone implement-slice changelog step
**Preconditions**:
- `CHANGELOG.md` exists at project root
- A `## <today's UTC date>` heading already exists in the file (earlier work was completed today)
- The new entry's name does NOT match any existing entry under today's heading (idempotency check passes)

**Trigger**: The changelog writer procedure runs and finds a matching day heading

### Primary Flow (Happy Path)

1. The changelog writer retrieves the real UTC timestamp via `date -u`
2. The writer opens `CHANGELOG.md` and scans for the `## <today's date>` heading
3. The heading is found
4. The writer applies the idempotency guard: scans all `### ...` entries under that heading for an entry whose name matches the current entry name — no match found
5. The writer inserts the new `### <name> — HH:MM UTC` entry as the **first** entry immediately after the `## <today's date>` heading line
6. All previously existing entries under that heading are preserved below the new entry (newest-first ordering maintained)
7. The file is saved

**Postconditions**:
- The new entry is the first entry under today's `## YYYY-MM-DD` heading
- Prior entries under that heading remain unchanged and appear below the new entry
- No day heading is created or deleted
- The `# Changelog` header block is unchanged

### Alternative Flows

- **UC-3-A1: Day heading exists but has no entries yet** — the heading was created by a prior run that only inserted the heading (edge case from a partial write)
  1. The writer finds the `## <today's date>` heading
  2. No `###` entries exist between that heading and the next `##` heading (or end of file)
  3. The new entry is written immediately after the day heading; the result is the same as the primary flow

### Error Flows

- **UC-3-E1: File read/write conflict during insertion** — the file is locked or partially written
  1. The writer attempts to insert the entry at the correct position
  2. A write error occurs (e.g., file system permission issue)
  3. Claude surfaces the error; the original file content is not corrupted (the write was atomic or failed before modifying the file)
  4. The developer resolves the issue and retriggers the write

### Edge Cases

- **UC-3-EC1**: Two units of work complete on the same UTC day in the same session. The second write finds the day heading (already created by the first write) and prepends the second entry above the first. The file ends up with both entries under one heading, newest first — the correct result.
- **UC-3-EC2**: The existing day heading's date is formatted differently (e.g., `## 2026-6-2` instead of `## 2026-06-02`). The writer uses zero-padded ISO 8601 format from `date -u`; if the existing heading uses a non-matching format, the writer treats it as a different heading and inserts a new `## 2026-06-02` heading. This is a defect scenario — the rule must specify zero-padded format to prevent it.

### Data Requirements

- **Input**: `CHANGELOG.md` content; today's UTC date (from `date -u`); the new entry text
- **Output**: `CHANGELOG.md` with the new entry prepended under the existing day heading; all prior content preserved
- **Side Effects**: `CHANGELOG.md` is updated in place

---

## UC-4: First Entry of a New Day Creates a New Day Heading

**Actor**: Claude executing either the merge-ready finalization step or the standalone implement-slice changelog step
**Preconditions**:
- `CHANGELOG.md` exists at project root with the `# Changelog` header block
- No `## <today's UTC date>` heading exists in the file (today is a new day)
- At least one prior `## YYYY-MM-DD` heading may or may not exist (file may have older entries)

**Trigger**: The changelog writer procedure runs and finds no matching day heading for today

### Primary Flow (Happy Path)

1. The changelog writer retrieves the real UTC timestamp via `date -u`
2. The writer opens `CHANGELOG.md` and scans for a `## <today's date>` heading — none found
3. The writer constructs a new `## YYYY-MM-DD` block using today's real UTC date
4. The new block is inserted immediately after the `# Changelog` header block (and its subtitle line, if present), **above any existing older `## YYYY-MM-DD` headings**
5. The new entry `### <name> — HH:MM UTC` is written as the first entry under the new day heading
6. All older day headings and their entries remain below, unchanged
7. The file is saved

**Postconditions**:
- A new `## YYYY-MM-DD` heading exists for today, positioned above all older headings
- The new entry is the first and only entry under the new heading
- All prior day headings and entries are preserved below
- The `# Changelog` header block is unchanged and remains the first content in the file

### Alternative Flows

- **UC-4-A1: CHANGELOG.md is empty (exists but contains only the header block)** — this is a newly scaffolded project or a project where all prior entries were removed
  1. The writer finds the `# Changelog` header block
  2. No `## YYYY-MM-DD` headings exist
  3. The new day heading and entry are appended after the header block
  4. The result is a file with one day heading and one entry

- **UC-4-A2: CHANGELOG.md has multiple prior day headings** — several days of entries already exist
  1. The writer scans past all prior `## YYYY-MM-DD` headings (all are in the past relative to today)
  2. The new `## <today's date>` heading is inserted after the `# Changelog` header block and before the first prior heading
  3. Newest-day-first ordering is maintained

### Error Flows

- **UC-4-E1: The `# Changelog` header block is missing** — the file exists but was manually edited and lost its header
  1. The writer scans `CHANGELOG.md` for the `# Changelog` line — not found
  2. The writer prepends the `# Changelog` header block to the file, then inserts the new day heading and entry immediately after it
  3. Existing content (prior day headings and entries) is preserved below

### Edge Cases

- **UC-4-EC1**: The UTC date at the time of the write is different from the UTC date when the slice was committed (the slice was committed just before midnight UTC, and the write fires just after midnight). The writer uses the timestamp from `date -u` at the moment of writing — not the commit timestamp. The entry lands under the date when the write executes.
- **UC-4-EC2**: Two parallel processes (hypothetical — not a valid pipeline state, since parallel-wave subagents must not write) attempt to create the same day heading simultaneously. The suppression rules and idempotency guard prevent this from occurring in practice. If it did occur, the second writer would find the heading already created and follow the UC-3 flow instead.

### Data Requirements

- **Input**: `CHANGELOG.md` content (header block and any existing older entries); today's real UTC date from `date -u`; the new entry text
- **Output**: `CHANGELOG.md` with a new `## YYYY-MM-DD` heading inserted above prior headings, containing the new entry
- **Side Effects**: `CHANGELOG.md` is updated in place; prior content is not modified

---

## UC-E1: Idempotency Guard Prevents Duplicate Entries

**Actor**: Claude executing the changelog writer procedure (either from `/merge-ready` or standalone `/implement-slice`)
**Preconditions**:
- `CHANGELOG.md` exists and contains an entry for the current feature/fix name under today's `## YYYY-MM-DD` heading
- The changelog writer procedure is about to write again for the same name on the same day

**Trigger**: The writer's idempotency check fires — a matching name is found under today's heading

### Primary Flow (Update in Place)

1. The writer retrieves the real UTC timestamp via `date -u`
2. The writer scans `CHANGELOG.md` for today's `## YYYY-MM-DD` heading — found
3. The writer scans the entries under that heading for a `### <name>` match — **match found**
4. Instead of appending a new entry, the writer **updates the existing entry in place**: replaces the `HH:MM UTC` timestamp with the new timestamp and replaces the `**Summary:**` and `**Details:**` content with the new values
5. No duplicate entry is created
6. The file is saved with exactly one entry for that name under today's heading

**Postconditions**:
- Exactly one entry exists for the feature/fix name under today's `## YYYY-MM-DD` heading
- The entry reflects the most recent write (updated timestamp, Summary, Details)
- No duplicate `###` heading exists for the same name in the same day section

### Alternative Flows

- **UC-E1-A1: Same name, different day** — prior entry exists under a past `## YYYY-MM-DD` heading but not under today's heading
  1. The writer scans today's heading section only — no match found under today's heading
  2. The guard does NOT trigger based on prior-day entries
  3. A new entry is written under today's heading (primary flow of UC-3 or UC-4)
  4. The prior-day entry is preserved unchanged

### Error Flows

- **UC-E1-E1: CHANGELOG.md cannot be parsed to find the day section** — the file is malformed
  1. The writer attempts to locate today's `## YYYY-MM-DD` heading
  2. The file structure is malformed (e.g., missing heading markers, corrupted content)
  3. The writer treats the search as "heading not found" and proceeds with UC-4 (create new day heading)
  4. The writer logs a warning that the file may have pre-existing malformed content

### Edge Cases

- **UC-E1-EC1**: The developer manually ran `/merge-ready` after a standalone `/implement-slice` already wrote an entry for the same feature on the same day. The idempotency guard fires during the merge-ready finalization step and updates the existing entry rather than creating a duplicate. The developer sees one entry with the merge-ready timestamp — the correct result.
- **UC-E1-EC2**: The feature name changed between the standalone fix write and the merge-ready write (the developer renamed the feature). The idempotency guard searches by name; the names do not match. Two entries appear under today's heading — one with the old name (from the standalone fix) and one with the new name (from merge-ready). This is an acceptable outcome; deduplication cannot work across name changes.
- **UC-E1-EC3**: The `###` heading line for the existing entry uses a slightly different name format (e.g., trailing space, different capitalisation). The guard uses a case-insensitive, trimmed comparison to detect the match, avoiding false misses on trivial formatting differences.

### Data Requirements

- **Input**: `CHANGELOG.md` content; the entry name being written; today's UTC date
- **Output**: Either an updated existing entry (if duplicate detected) or a new entry (if no duplicate)
- **Side Effects**: `CHANGELOG.md` is updated in place; only the matching entry's content is changed when updating

---

## UC-E2: Suppression Guard Prevents Slice from Writing During Pipeline Run

**Actor**: Claude executing `/implement-slice` as part of a `/develop-feature` pipeline run
**Preconditions**:
- `/develop-feature` has passed the `no-changelog` suppression flag to this `/implement-slice` invocation (covers both the single-slice-wave direct path and parallel-wave subagent spawn)
- The slice has committed successfully

**Trigger**: The changelog step in `/implement-slice` is reached after the commit

### Primary Flow (Suppression Active — No-Op)

1. The slice implementation completes and the commit is made
2. The changelog step begins
3. Claude evaluates the skip conditions:
   - Is the `no-changelog` flag present? — **Yes**
4. The changelog step is a complete no-op; no `CHANGELOG.md` read or write occurs
5. Claude proceeds to the scratchpad update step (if applicable) or returns control to the orchestrator
6. Later, when all slices in the feature are complete and `/merge-ready` runs, the finalization step writes exactly one entry for the entire feature

**Postconditions**:
- `CHANGELOG.md` is unchanged after the slice commits
- No entry was written by this slice
- The subsequent `/merge-ready` finalization step will write the single authoritative entry

### Alternative Flows

- **UC-E2-A1: Parallel-wave subagent — wave context present (no flag needed)**
  1. The slice executes as a parallel-wave subagent (wave context is present in the spawn prompt)
  2. Even without an explicit `no-changelog` flag, the parallel-wave subagent skip condition triggers independently
  3. The changelog step is a no-op by the subagent rule (consistent with Section 2 FR-2.6)
  4. The orchestrator (`/develop-feature`) handles all changelog coordination; merge-ready writes the single entry

### Error Flows

- **UC-E2-E1: Suppression flag missing — develop-feature forgot to pass it**
  1. `/develop-feature` invokes `/implement-slice` without passing the `no-changelog` flag
  2. The slice completes, commits, and the changelog step fires
  3. The slice writes an entry to `CHANGELOG.md`
  4. Later, `/merge-ready` fires the finalization step and attempts to write again
  5. The idempotency guard detects the existing entry under today's heading for the same name
  6. The guard updates the existing entry rather than appending a duplicate
  7. The final result is exactly one entry — the idempotency guard is the safety net for this failure mode

### Edge Cases

- **UC-E2-EC1**: `/develop-feature` correctly passes the suppression flag for all parallel-wave subagents but omits it for the single-slice-wave direct path (an authoring error in the command). The single-slice-wave invocation writes an entry. Merge-ready's idempotency guard prevents the duplicate. The QA structural check for `/develop-feature` must assert both paths carry the flag.
- **UC-E2-EC2**: The `no-changelog` flag is present but the implement-slice instruction does not recognise it (an authoring error in the implement-slice command — the flag check is missing). Both the slice and merge-ready write entries. The idempotency guard is the last line of defence. The QA structural check for `/implement-slice` must assert both skip conditions are documented.

### Data Requirements

- **Input**: Presence or absence of `no-changelog` flag in the spawn context; presence or absence of wave context
- **Output**: A no-op on `CHANGELOG.md` when either skip condition is active
- **Side Effects**: None — `CHANGELOG.md` is not read or written when suppressed

---

## UC-E3: Real UTC Timestamp Retrieved via Shell — Hallucination Forbidden

**Actor**: Claude at any changelog write point (merge-ready finalization or standalone implement-slice changelog step)
**Preconditions**:
- A changelog entry is about to be written (all preconditions for UC-1 or UC-2 are met)
- A Bash shell is available in the current execution environment

**Trigger**: The changelog writer procedure begins (step 1: retrieve timestamp)

### Primary Flow (Real Timestamp Retrieved)

1. Claude invokes `date -u +'%Y-%m-%d %H:%M'` via the Bash tool
2. The command executes successfully and returns a string in the form `2026-06-02 14:30`
3. Claude uses the returned string — verbatim — as the date and time fields in the changelog entry
4. The `## YYYY-MM-DD` heading uses the date portion; the `### <name> — HH:MM UTC` heading uses the time portion
5. The writer procedure continues with the verified real timestamp

**Postconditions**:
- The date and time in the entry match the real UTC clock at the moment of writing
- No invented or estimated date/time appears anywhere in the entry

### Error Flows

- **UC-E3-E1: Bash is unavailable or `date -u` fails**
  1. Claude invokes `date -u` and the command fails or returns empty output
  2. Claude MUST NOT substitute a guessed or hallucinated timestamp
  3. Claude reports the failure: "Could not retrieve UTC timestamp — changelog entry not written"
  4. No entry is written to `CHANGELOG.md`
  5. The failure is surfaced in the command output so the developer can diagnose the environment issue
  6. The developer resolves the Bash availability issue and retriggers the write

- **UC-E3-E2: Agent invents a timestamp (defect scenario)**
  1. The agent writes a changelog entry with a date or time that was not retrieved from `date -u`
  2. This is explicitly classified as a **defect** — not an acceptable alternative flow
  3. Detection: the QA structural check asserts that every write-path instruction in every modified file contains `date -u` literally, ensuring the retrieval requirement cannot be silently omitted
  4. The idempotency guard cannot detect this defect (it checks names, not timestamps); timestamp accuracy is enforced purely through instruction compliance

### Edge Cases

- **UC-E3-EC1**: The developer is in a timezone far from UTC. The `date -u` command still produces UTC output regardless of the local timezone setting — this is the purpose of the `-u` flag. The changelog entry always reflects UTC.
- **UC-E3-EC2**: The command runs just before midnight UTC (e.g., `2026-06-02 23:59`) and the file write completes just after midnight (`2026-06-03 00:00`). The timestamp in the entry reflects the moment `date -u` was called, not the moment the file was saved. This minor discrepancy is acceptable; the instruction mandates calling `date -u` immediately before writing.

### Data Requirements

- **Input**: None beyond the Bash shell environment
- **Output**: A real UTC timestamp string in `YYYY-MM-DD HH:MM` format
- **Side Effects**: None — this is a read-only shell invocation

---

## UC-E4: Details Field Trimmed to 500-Character Cap

**Actor**: Claude constructing a changelog entry (at either write trigger)
**Preconditions**:
- A changelog entry is being assembled
- The intended Details text exceeds 500 characters

**Trigger**: The writer procedure's step 4 (enforce 500-character cap) executes

### Primary Flow (Trim Applied)

1. Claude assembles the four entry fields: Date+time, Name, Summary, Details
2. Claude measures the length of the Details text
3. The Details text is 501 or more characters
4. Claude trims the Details to exactly 500 characters
5. The trimming is performed silently — no error is raised, no user prompt is issued
6. The trimmed Details is used in the entry that is written to `CHANGELOG.md`

**Postconditions**:
- The `**Details:**` field in the written entry is exactly ≤ 500 characters
- The entry is otherwise complete and valid
- The developer is not prompted or interrupted by the trim operation

### Alternative Flows

- **UC-E4-A1: Details text is exactly 500 characters** — no trimming needed
  1. Claude measures the length — exactly 500 characters
  2. No trimming is applied
  3. The entry is written with the full Details text

- **UC-E4-A2: Details text is under 500 characters** — normal case
  1. Claude measures the length — under 500 characters
  2. No action taken; the text is written as-is

### Error Flows

- **UC-E4-E1: Summary field is empty or non-technical jargon** — a content quality issue, not a length issue
  1. The Summary field is empty or contains only technical identifiers (e.g., function names, error codes) rather than a human-readable one-liner
  2. This is a content defect in the entry, not a rule violation that the writer procedure can automatically fix
  3. The writer procedure writes the entry with the provided Summary (even if low quality)
  4. The QA test cases for this use case flag an empty or non-technical Summary as a defect to detect in structural checks

### Edge Cases

- **UC-E4-EC1**: The trim cuts a sentence mid-word. Claude trims to 500 characters without appending an ellipsis or any indicator of truncation — the rule specifies only the character cap, not a graceful truncation style. A future rule revision may refine this; for now, hard truncation at 500 is correct behavior.
- **UC-E4-EC2**: The Details field contains multi-byte Unicode characters (e.g., emoji, CJK). The 500-character cap applies to the character count (Unicode code points), not the byte count. The writer measures in characters.

### Data Requirements

- **Input**: Raw Details text (any length); 500-character cap constant from `src/rules/changelog.md`
- **Output**: Details text ≤ 500 characters
- **Side Effects**: None — this is an in-memory transformation before the file write

---

## UC-5: Two Completed Units on the Same UTC Day

**Actor**: Claude executing two separate changelog writes on the same UTC calendar day
**Preconditions**:
- At least one changelog entry already exists under today's `## YYYY-MM-DD` heading
- A second, different unit of work (different name) completes and triggers a second write on the same day

**Trigger**: The second changelog write fires (from either merge-ready or standalone implement-slice) with a different feature/fix name from the first

### Primary Flow (Happy Path — Both Entries Under One Day Heading)

1. The first unit completes earlier in the day; its entry is written under `## YYYY-MM-DD` as the sole entry (UC-1 or UC-2 primary flow)
2. Later the same UTC day, the second unit completes
3. The second writer retrieves a new real UTC timestamp via `date -u`
4. The writer applies the idempotency guard: scans today's heading for the second unit's name — not found (different name)
5. The writer prepends the second entry as the **first** entry under today's `## YYYY-MM-DD` heading (UC-3 flow)
6. The first entry is now the second entry under the heading

**Postconditions**:
- Exactly one `## YYYY-MM-DD` heading exists for today
- Two entries exist under that heading; the second-completed entry appears first (newest-first ordering)
- Both entries have distinct `HH:MM` timestamps; the second entry's timestamp is later
- No duplicate entries; no extra day headings

### Edge Cases

- **UC-5-EC1**: The first and second units complete so close together (within the same minute) that `date -u` returns the same `HH:MM` value for both. Both entries exist under the same day heading; they differ by name but share the same timestamp display. This is acceptable — entries are keyed by name (for idempotency), not by timestamp.
- **UC-5-EC2**: Three or more units complete on the same day. Each subsequent write prepends its entry under the existing day heading. After N completions, the day heading contains N entries in newest-first order. The structure is correct regardless of N.

### Data Requirements

- **Input**: The existing `CHANGELOG.md` with one prior entry under today's heading; the second entry's fields; real UTC timestamp
- **Output**: `CHANGELOG.md` with two entries under today's heading, newest first
- **Side Effects**: `CHANGELOG.md` updated in place; only the day section is modified

---

## UC-6: Feature Taken Through Full /develop-feature Pipeline — Exactly One Entry

**Actor**: Claude executing a complete `/develop-feature` run including all slices and `/merge-ready`
**Preconditions**:
- A multi-slice feature is being developed using `/develop-feature`
- `/develop-feature` passes the `no-changelog` flag to every `/implement-slice` it drives (FR-4.1)
- All slices commit successfully and all quality gates PASS

**Trigger**: `/develop-feature` completes all slices and invokes `/merge-ready`; the merge-ready finalization step fires

### Primary Flow (Exactly One Entry)

1. Wave 1 executes: one or more slices complete with commits, each receiving the `no-changelog` flag — zero entries written
2. Wave 2 executes (if applicable): same as wave 1 — zero entries written by any subagent
3. All waves complete; `/develop-feature` invokes `/merge-ready`
4. All quality gates PASS
5. The "Finalization: Changelog Entry" section executes exactly once
6. One entry is written to `CHANGELOG.md` for the entire feature

**Postconditions**:
- Exactly one entry exists in `CHANGELOG.md` for this feature, under today's `## YYYY-MM-DD` heading
- No entries were written by any individual slice
- The single entry's timestamp is from the merge-ready finalization moment

### Edge Cases

- **UC-6-EC1**: The feature has 8 slices across 2 waves. After all 8 slices commit with the suppression flag, `/merge-ready` writes 1 entry. The file has 1 entry — not 8. This is the core correctness requirement.
- **UC-6-EC2**: `/develop-feature` fails partway through (a slice exhausts its retry budget and the developer chooses to abort). No merge-ready runs. No changelog entry is written. The CHANGELOG.md reflects only completed, gated work — not partial work. If the developer later re-runs and completes the feature, one entry is written by merge-ready.

### Data Requirements

- **Input**: Feature name, Summary, Details; all gate results (PASS); real UTC timestamp at merge-ready finalization
- **Output**: Exactly one entry in `CHANGELOG.md`
- **Side Effects**: `CHANGELOG.md` created or updated; all prior content preserved

---

## UC-7: CHANGELOG.md Does Not Exist — Created on First Write

**Actor**: Claude at the first changelog write event in a project (either trigger)
**Preconditions**:
- The project has no `CHANGELOG.md` at its root (was not scaffolded with `--init-project`, or the file was deleted)
- A changelog write is about to occur

**Trigger**: The writer procedure's step 2 (check if CHANGELOG.md is absent) fires

### Primary Flow (File Created)

1. The writer retrieves the real UTC timestamp
2. The writer checks for `CHANGELOG.md` at project root — **not found**
3. The writer creates `CHANGELOG.md` with the `# Changelog` header block:
   ```
   # Changelog

   All notable changes to this project, newest first. Entries are grouped by UTC date.
   ```
4. The writer inserts the new day heading and entry per UC-4 flow
5. The file is saved

**Postconditions**:
- `CHANGELOG.md` exists at project root
- It starts with the `# Changelog` header block
- It contains exactly one day heading and one entry
- No prior content was lost (there was none)

### Alternative Flows

- **UC-7-A1: Project was scaffolded with `--init-project`** — CHANGELOG.md already exists from the template
  1. The writer checks for `CHANGELOG.md` — **found** (contains only the `# Changelog` header block from the template)
  2. The "create if absent" step is skipped (file already exists)
  3. The writer proceeds with UC-4 (first entry of a new day) since no day headings exist yet

### Edge Cases

- **UC-7-EC1**: The writer creates `CHANGELOG.md` with the correct header but a subsequent file-system error prevents saving. The file either does not exist or is empty. On the next write attempt, the writer treats the file as absent and recreates it. No data is lost since the file had no prior entries.

### Data Requirements

- **Input**: Project root path; the entry to write
- **Output**: A new `CHANGELOG.md` file with the standard header block, a day heading, and the first entry
- **Side Effects**: New file created at project root
