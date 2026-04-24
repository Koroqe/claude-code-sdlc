# Use Cases: Product Changelog Maintenance -- Iteration 1 (Content Sync)

> Based on [PRD](../PRD.md) -- Section 3: Product Changelog Maintenance -- Iteration 1: Content Sync

This document is the blueprint for E2E testing of the `changelog-writer` agent and its four pipeline hooks. Every use case is precise enough for a test to be derived without re-consulting the PRD. Scenario IDs (`UC-N`, `UC-N-A1`, `UC-N-E1`, `UC-N-EC1`) are referenced by QA test cases and E2E tests.

---

## UC-1: First-Ever Changelog Entry in a Configured Downstream Project

**Actor**: `changelog-writer` agent, invoked by the orchestrator (main Claude) at one of the four lifecycle hooks
**Preconditions**:
- The project is a configured downstream project -- `.claude/rules/changelog.md` exists in the project CWD (installed by `install.sh --init-project` per FR-1.3)
- `CHANGELOG.md` does NOT exist at the project root
- `docs/PRD.md` exists and contains at least one PRD section whose `Changelog:` field is a user-facing description (NOT `skip -- internal`)
- At least one commit exists on the current feature branch whose work maps to that PRD section (per FR-2.4: only work with a corresponding commit is eligible)
- `.claude/scratchpad.md` exists with a valid `## Feature:` entry for the current branch
- `git merge-base main HEAD` returns a valid commit hash

**Trigger**: The orchestrator delegates to `changelog-writer` at any of the four lifecycle hooks (post-bootstrap, post-commit standalone, post-wave, or pre-flight `/merge-ready`) with no arguments beyond the CWD context (per FR-4.6)

### Primary Flow (Happy Path)

1. `changelog-writer` performs the self-check: reads `.claude/rules/changelog.md` at CWD (per FR-2.2)
2. The self-check succeeds -- the rule file exists, so the agent is "configured" and proceeds
3. The agent reads the inputs in the FR-2.3 order: (a) `docs/PRD.md`, (b) `.claude/scratchpad.md`, (c) `git log <merge-base>..HEAD` where `<merge-base>` is the output of `git merge-base main HEAD`, (d) attempts to read `CHANGELOG.md` and finds it absent
4. The agent parses every PRD section's `Changelog:` field and identifies which sections have user-facing values vs. `skip -- internal`
5. The agent cross-references commits from `git log` against PRD sections: only PRD sections whose associated work has at least one corresponding commit are "eligible" (per FR-2.4)
6. The agent excludes any PRD section with `Changelog: skip -- internal` even if it has shipped commits (per FR-2.4)
7. The agent maps each eligible entry to one of the six Keep a Changelog categories (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) using PRD section nature: new features default to `Added`, modifications default to `Changed`, bug fixes to `Fixed`, etc. (per FR-2.5)
8. Because `CHANGELOG.md` does not exist AND at least one eligible entry was computed, the agent creates `CHANGELOG.md` at the project root (per FR-2.8)
9. The created file has: (a) the Keep a Changelog title heading, (b) a description paragraph linking to keepachangelog.com, (c) a semver note, (d) an `[Unreleased]` section containing the computed entries grouped under their six-category subheadings in the standard order
10. The agent outputs its structured summary (per FR-2.9): self-check result = `configured`, source counts (N commits read, M PRD sections read), computed entries per category, action taken = `created`, any ambiguous category choices with justification
11. The agent does NOT modify `docs/PRD.md`, `.claude/scratchpad.md`, or any file other than `CHANGELOG.md` at the project root (per FR-2.10)

**Postconditions**:
- `CHANGELOG.md` exists at the project root with a Keep a Changelog header and a populated `[Unreleased]` section
- The `[Unreleased]` section contains exactly the computed entries; no internal work is listed; no entries for skipped PRD sections
- `docs/PRD.md` and `.claude/scratchpad.md` are unchanged
- The agent output contains `configured`, source counts, and `action taken: created`
- No network access was performed (per NFR-7)
- The pipeline is not blocked by this invocation (per FR-4.5)

**Related FR/AC**: FR-1.4, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.8, FR-2.9, FR-2.10, FR-4.6, NFR-7 / AC-4, AC-15

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-1-A1: `CHANGELOG.md` already exists -- append-only to `[Unreleased]`** -- A `CHANGELOG.md` is present at the project root (from an earlier release cycle or a previous invocation of this agent) and contains one or more prior versioned sections (e.g., `[1.2.0]`, `[1.1.0]`)
  1. Steps 1-7 proceed as in the primary flow (self-check, input reads, eligibility computation, category mapping)
  2. At step 8, the agent detects that `CHANGELOG.md` already exists -- it does NOT create a new file
  3. The agent parses the existing `CHANGELOG.md` and locates the `[Unreleased]` section (or determines its insertion point immediately under the header if `[Unreleased]` is missing)
  4. The agent computes the intended `[Unreleased]` content and diffs it against the current `[Unreleased]` content (per FR-2.6, whitespace-insensitive)
  5. If the content has changed, the agent rewrites ONLY the `[Unreleased]` section
  6. Prior versioned sections (`[1.2.0]`, `[1.1.0]`, etc.) remain byte-for-byte identical after the write (per FR-2.7)
  7. The agent output records `action taken: rewrote` and lists which category buckets were modified

**Postconditions (UC-1-A1)**:
- `CHANGELOG.md` has an updated `[Unreleased]` section
- All prior versioned sections are unchanged byte-for-byte
- The agent output identifies `action taken: rewrote`

**Related FR/AC**: FR-2.6, FR-2.7

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific to first-ever creation beyond those captured in UC-6 and UC-2 error flows. Failures during read of `docs/PRD.md` or `git log` are handled per UC-2-E1.

### Edge Cases

- **UC-1-EC1: Rule file present but no eligible entries yet** -- The project is configured, `CHANGELOG.md` does not exist, and no branch commit maps to a non-skip PRD section (e.g., the only commits so far cover a PRD section with `Changelog: skip -- internal`)
  1. Steps 1-7 proceed as in the primary flow
  2. At step 8, the computed entry set is empty
  3. The agent MUST NOT create `CHANGELOG.md` (per FR-2.8: "If no eligible entries are computed, the agent MUST NOT create the file -- no empty changelog")
  4. The agent returns the structured summary with `action taken: no-op (no eligible entries)` and source counts showing zero eligible commits

**Related FR/AC**: FR-2.8

### Data Requirements

- **Input**: `.claude/rules/changelog.md` (presence check), `docs/PRD.md`, `.claude/scratchpad.md`, `git log <merge-base>..HEAD`, `CHANGELOG.md` (absent in UC-1, present in UC-1-A1)
- **Output**: `CHANGELOG.md` at the project root (created in UC-1, rewritten in UC-1-A1); structured summary to caller
- **Side Effects**: Single file write to `CHANGELOG.md`. No git commit is created by the agent itself -- the file write piggybacks on the surrounding slice commit (per PRD 3.6 Unchanged Files note on `src/rules/git.md`). No network. No mutation of PRD or scratchpad.

---

## UC-2: Continuous Maintenance Through a Full Feature Lifecycle

**Actor**: `changelog-writer` agent, invoked repeatedly by the pipeline over the course of a feature branch's life
**Preconditions**:
- The project is a configured downstream project (`.claude/rules/changelog.md` exists)
- A feature branch has been created and `/bootstrap-feature` has just produced a PRD section with a valid non-skip `Changelog:` value
- `.claude/scratchpad.md` has been initialized with the feature, branch, and wave-grouped plan (or flat-list plan for legacy plans)
- The planner has produced a plan where at least some slices are in single-slice waves (i.e., standalone `/implement-slice` invocations will occur, not just parallel subagents)

**Trigger**: The pipeline reaches each of the four FR-4 lifecycle hooks in order: (1) post-`/bootstrap-feature` step 5, (2) post-commit in `/implement-slice` standalone mode, (3) post-wave in `/develop-feature`, (4) pre-flight in `/merge-ready`

### Primary Flow (Happy Path)

1. **Hook 1 -- post-bootstrap (FR-4.1)**: `/bootstrap-feature` completes step 5 (Tech Lead Implementation Planning). Immediately after, the orchestrator delegates to `changelog-writer` with no arguments
2. `changelog-writer` self-checks -- rule file present -- proceeds
3. `changelog-writer` reads PRD + scratchpad + `git log <merge-base>..HEAD` + `CHANGELOG.md` (if present)
4. No commits yet exist on this branch that map to the newly written PRD section. If `CHANGELOG.md` already exists from a previous feature cycle, the `[Unreleased]` section reflects whatever prior eligible commits landed on this branch; the agent's computed content matches the current file. Agent returns `no-op: already in sync` (per FR-2.6). If `CHANGELOG.md` does not exist AND there are no eligible prior commits, agent returns no-op per UC-1-EC1
5. **Hook 2 -- post-commit standalone `/implement-slice` (FR-4.2)**: The developer runs `/implement-slice` for a single-slice wave. The slice commits successfully. Because no wave context is present in the spawn prompt, `/implement-slice` delegates to `changelog-writer` (per FR-4.2 standalone branch)
6. `changelog-writer` self-checks, reads inputs. The new commit is visible in `git log`. If the commit maps to a non-skip PRD section, the agent computes a new/updated entry under the correct Keep a Changelog category
7. The agent rewrites `[Unreleased]` if and only if the computed content differs from the current file (per FR-2.6, whitespace-insensitive). Prior versioned sections untouched (per FR-2.7). Output records `action taken: rewrote` (or `no-op: already in sync` if the earlier post-bootstrap run already produced equivalent content)
8. Steps 5-7 repeat for every subsequent standalone `/implement-slice` invocation
9. **Hook 3 -- post-wave (FR-4.3)**: When `/develop-feature` completes a multi-slice wave, the orchestrator delegates to `changelog-writer` ONCE after all subagents return. Subagents inside the wave do NOT invoke the agent (per FR-4.2). See UC-3 for the parallel-wave scenario
10. **Hook 4 -- pre-flight `/merge-ready` (FR-4.4)**: The developer runs `/merge-ready`. Before Gate 0 (Git Hygiene), the command delegates to `changelog-writer` as a silent safety-net sync
11. The pre-flight sync either returns `no-op: already in sync` (common case -- previous hook points kept content in sync) and `/merge-ready` proceeds to Gate 0 with no extra output; OR returns `action taken: rewrote` (uncommon -- e.g., PRD edited since last sync per UC-2-A1), and `/merge-ready` surfaces the diff summary in its output before proceeding to Gate 0 (per FR-4.4)
12. The pre-flight sync is NOT a new gate. It cannot fail `/merge-ready`. The gate count is unchanged (per FR-4.5, AC-11)

**Postconditions**:
- Across the full feature lifecycle, `[Unreleased]` in `CHANGELOG.md` always reflects the union of eligible shipped commits at any point in time
- Most hook invocations are no-ops (per NFR-6 idempotency and NFR-8 performance)
- Each non-noop invocation rewrites ONLY `[Unreleased]`; prior versioned sections are byte-identical
- `/merge-ready` gate list count is unchanged; no Gate 10 exists (per AC-11 and PRD 3.8)

**Related FR/AC**: FR-2.3, FR-2.4, FR-2.6, FR-2.7, FR-4.1, FR-4.2 (standalone branch), FR-4.3, FR-4.4, FR-4.5, NFR-6, NFR-8 / AC-6, AC-8, AC-9, AC-10, AC-11

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-2-A1: PRD edited mid-feature** -- The developer edits `docs/PRD.md` (e.g., rewords the `Changelog:` value, adds a new subsection, flips `skip -- internal` to a user-facing description, or vice versa) between two hook invocations, with no new commit in between
  1. The developer modifies `docs/PRD.md` and saves
  2. The next hook invocation fires (e.g., post-commit on an unrelated slice, or pre-flight `/merge-ready`)
  3. `changelog-writer` re-reads PRD fresh on every invocation (per FR-2.3; inputs are always discovered from disk, per FR-4.6)
  4. The agent recomputes the intended `[Unreleased]` content. Because the PRD has changed, the computed content will differ from the current file
  5. The agent rewrites `[Unreleased]` to reflect the updated PRD
  6. The rewrite is idempotent -- a subsequent invocation with no further edits returns `no-op: already in sync` (per NFR-6, AC-6)
  7. Output records `action taken: rewrote` with a diff summary

**Related FR/AC**: FR-2.3, FR-2.6, FR-4.6, NFR-6

- **UC-2-A2: Scope flipped from internal to user-facing mid-implementation** -- A PRD section originally marked `Changelog: skip -- internal` is changed to a user-facing description after several of its commits have already shipped
  1. Commits C1, C2 land on the branch while the PRD section is marked `skip -- internal`. At each post-commit hook invocation, the agent excludes these commits from `[Unreleased]` (per FR-2.4)
  2. The developer edits the PRD to change `Changelog: skip -- internal` to `Changelog: Users can export reports to PDF` (or similar non-skip value)
  3. The next hook invocation fires
  4. The agent re-reads the PRD. The previously excluded commits now map to a non-skip PRD section and become eligible (per FR-2.4 and FR-2.3 input re-read)
  5. The agent recomputes `[Unreleased]` and includes an entry for this feature under the appropriate category
  6. Output records `action taken: rewrote`

**Related FR/AC**: FR-2.3, FR-2.4, FR-4.6

- **UC-2-A3: Scope flipped from user-facing to internal mid-implementation** -- The mirror image of UC-2-A2: a PRD section initially had a user-facing `Changelog:` value; the developer changes it to `skip -- internal` after commits have shipped
  1. Commits land, agent adds entries to `[Unreleased]`
  2. Developer edits the PRD `Changelog:` field to `skip -- internal`
  3. Next hook invocation: agent recomputes, the prior entries no longer appear because the PRD section is excluded (per FR-2.4)
  4. Agent rewrites `[Unreleased]`, removing the now-excluded entries
  5. Prior versioned sections (if any) remain untouched (per FR-2.7)
  6. Output records `action taken: rewrote` with a diff summary that shows the removal

**Related FR/AC**: FR-2.4, FR-2.7, FR-4.6

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-2-E1: `git merge-base main HEAD` fails -- degraded mode** -- The merge-base computation fails (e.g., the branch has no shared ancestor with `main` in an unusual workflow; a new repo with no `main`; shallow clone without sufficient history)
  1. The agent runs `git merge-base main HEAD`
  2. The command returns a non-zero exit status or empty output
  3. Per the PRD Risk 3.9 item 8 and error-recovery Rule 2 (auto-add), the agent MUST fall back gracefully rather than fail
  4. The agent reads the full branch log (`git log HEAD` or equivalent) instead of the ranged log
  5. The agent annotates its output with a degraded-mode note (e.g., `degraded mode: merge-base unresolved; using full branch log`)
  6. The agent proceeds with normal eligibility computation on the full-log result
  7. The agent still performs the diff against the current `CHANGELOG.md` and either rewrites or returns `no-op: already in sync`
  8. The caller is NOT failed (per FR-4.5, error-recovery Rule 2 auto-add)

**Related FR/AC**: FR-2.3, FR-4.5, NFR-7 (no network implies git failures cannot be remedied by fetching); PRD 3.9 item 8

**Related test case**: TC-TBD -- qa-planner will assign

- **UC-2-E2: `CHANGELOG.md` contains malformed Keep a Changelog markup** -- The existing file has non-standard structure: missing `[Unreleased]`, extra non-standard section between `[Unreleased]` and `[1.2.0]`, mismatched heading levels, or category heading spelled wrong
  1. The agent parses `CHANGELOG.md` and detects that the `[Unreleased]` section cannot be located using the standard Keep a Changelog conventions
  2. The agent MUST NOT silently repair, rearrange, or rewrite prior versioned sections (per FR-2.7: prior sections remain byte-for-byte untouched)
  3. If `[Unreleased]` is missing entirely, the agent inserts a fresh `[Unreleased]` section immediately under the file header (before any versioned section). The insertion MUST NOT delete or reorder any other content
  4. If `[Unreleased]` exists but is malformed in a way that prevents comparison, the agent rewrites ONLY that section with the computed content; the rest of the file is untouched
  5. The agent annotates its output summary with the malformed-markup observation so the caller is aware
  6. The agent does NOT fail the caller (per FR-4.5)

**Related FR/AC**: FR-2.7, FR-4.5

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-2-EC1: Hook fires between two commits in the same wave with scratchpad still mid-update** -- In standalone mode only (parallel is handled by UC-3). The scratchpad might show a wave `[IN PROGRESS]` with some slices marked DONE and others `pending`
  1. The agent reads the scratchpad fresh per FR-2.3
  2. The scratchpad does not constrain `[Unreleased]` content directly -- only commits do (per FR-2.4 source-of-truth priority: commits -> scratchpad -> PRD)
  3. The agent uses `git log` as the authoritative shipping record; the scratchpad informs which feature is active but is NOT consulted to decide inclusion
  4. Result is identical to a hook firing at any other point in time on the same commit set

**Related FR/AC**: FR-2.4, NFR-6

### Data Requirements

- **Input**: Rule file presence, `docs/PRD.md`, `.claude/scratchpad.md`, `git log <merge-base>..HEAD` (or full log if UC-2-E1), `CHANGELOG.md` (absent or present)
- **Output**: `CHANGELOG.md` (created, rewritten, or unchanged); structured per-invocation summary
- **Side Effects**: Zero or one file write per invocation. Idempotent: the same inputs produce the same result and the same no-op-vs-rewrite decision (per NFR-6). No network (NFR-7). Most invocations across a feature lifecycle are no-ops.

---

## UC-3: Parallel Wave Execution -- Orchestrator-Only Invocation

**Actor**: `/develop-feature` orchestrator (main Claude) coordinating a multi-slice wave
**Preconditions**:
- A multi-slice wave exists in the plan (e.g., Wave 2 with Slices 2, 3, 4) -- all slices have disjoint `Files:` lists per UC-1 from execution-waves
- The project is a configured downstream project (`.claude/rules/changelog.md` exists)
- Each slice's spawn prompt will include wave number, sibling slice numbers, and an explicit "skip scratchpad writes" instruction (per section 2 FR-2.6 -- the parallel-safety pattern that this feature reuses per FR-4.2)

**Trigger**: `/develop-feature` begins executing a multi-slice wave

### Primary Flow (Happy Path)

1. `/develop-feature` spawns one Agent subagent per slice in the wave (e.g., three subagents for Slices 2, 3, 4)
2. Each subagent receives its slice context AND an explicit instruction that wave context is present -- per FR-4.2, subagents in a wave MUST skip the `changelog-writer` invocation in their `/implement-slice` Step 5
3. Each subagent runs the TDD flow and commits its slice. Each successful commit lands on the branch independently
4. Per FR-4.2, NO subagent in the wave invokes `changelog-writer` after its commit. This prevents the double-write race identified in PRD 3.9 Risk item 3
5. `/develop-feature` waits for all subagents to complete (per UC-2 primary flow in execution-waves)
6. After all subagents in the wave return, and BEFORE proceeding to the next wave, the orchestrator delegates to `changelog-writer` ONCE (per FR-4.3)
7. `changelog-writer` self-checks, reads inputs, sees all new wave commits in `git log`
8. The agent computes the intended `[Unreleased]` content from the full post-wave commit set, diffs against the current file, and rewrites if changed
9. Output records `action taken: rewrote` (if the wave added one or more eligible entries) or `no-op: already in sync` (if all wave commits were `skip -- internal`)
10. The orchestrator proceeds to the next wave

**Postconditions**:
- `CHANGELOG.md` is written at most once per wave, by the orchestrator, after all subagents have finished
- No file-conflict race occurred during the wave (per FR-4.2 and PRD 3.9 Risk 3)
- The post-wave `[Unreleased]` content reflects the union of all eligible commits across every prior wave and the wave that just completed
- The orchestrator's commit hashes are preserved; no rollback of subagent commits occurs from the agent side (the agent never commits or reverts)

**Related FR/AC**: FR-2.4, FR-4.2 (subagent-skip branch), FR-4.3, FR-4.5, FR-4.6 / AC-9, AC-10

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-3-A1: Mixed-eligibility wave** -- Within a single wave, some slices cover a user-facing PRD section and others cover an internal `Changelog: skip -- internal` PRD section
  1. Subagents run in parallel. Some commits map to user-facing PRD sections; others map to internal sections
  2. No subagent invokes `changelog-writer` (per FR-4.2)
  3. After the wave, the orchestrator invokes `changelog-writer` once
  4. The agent computes eligibility per commit: only commits mapped to non-skip PRD sections are included in `[Unreleased]` (per FR-2.4)
  5. The agent rewrites `[Unreleased]` to include ONLY the user-facing eligible entries; internal-only commits are invisible in the output
  6. Output summary notes the source counts -- e.g., "3 commits read, 1 eligible, 2 skipped as internal"

**Related FR/AC**: FR-2.4, FR-4.3

- **UC-3-A2: Wave contains exactly one slice** -- Single-slice wave, but executed under `/develop-feature` orchestration (not standalone `/implement-slice`)
  1. `/develop-feature` sees a single-slice wave (Wave 2 has only Slice 3). Per section 2 UC-2-A1, the orchestrator may execute this directly via the existing `/implement-slice` workflow rather than spawning a subagent
  2. If the single-slice wave is executed by invoking `/implement-slice` WITHOUT wave context in the spawn prompt, `/implement-slice` runs in standalone mode and DOES invoke `changelog-writer` post-commit (per FR-4.2 standalone branch). In this case, the orchestrator MUST skip its own post-wave invocation to avoid a redundant second call in the same wave (idempotent per NFR-6, but wasteful)
  3. If the single-slice wave is executed by spawning a subagent WITH wave context, the subagent skips the invocation per FR-4.2 and the orchestrator runs `changelog-writer` once post-wave per FR-4.3
  4. Either execution path produces an identical final `CHANGELOG.md` state -- the agent is idempotent (NFR-6), so even a double-invocation would produce the same file content on the second call (the second call would be `no-op: already in sync`)

**Related FR/AC**: FR-4.2, FR-4.3, NFR-6

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-3-E1: Post-wave sync fails** -- The orchestrator's post-wave `changelog-writer` invocation crashes, times out, or returns an error
  1. Subagents have already completed and committed successfully. Those commits are preserved on the branch (per UC-2-E1 in execution-waves; failure isolation)
  2. The orchestrator invokes `changelog-writer` post-wave; the agent fails (crash, infrastructure, or Rule 3 retry exhaustion)
  3. Per FR-4.5, a `changelog-writer` failure MUST NOT block pipeline progression. The error MUST be logged and the pipeline MUST continue
  4. The orchestrator logs the error and proceeds to the next wave
  5. At the next hook invocation (end of next wave, or pre-flight `/merge-ready`), `changelog-writer` runs again with a fresh invocation -- inputs are re-read from disk (per FR-4.6)
  6. The next invocation sees the commits from the failed-sync wave and catches up: it computes the correct `[Unreleased]` content for the current full commit set and rewrites once
  7. Thus the failed sync is NOT lost; the idempotent re-invocation pattern (per NFR-6) guarantees eventual consistency

**Postconditions (UC-3-E1)**:
- The failed wave's commits are preserved
- `CHANGELOG.md` may be momentarily out of date until the next hook fires
- The pipeline is NOT blocked
- The next successful hook invocation reconciles the state without manual intervention

**Related FR/AC**: FR-4.5, FR-4.6, NFR-6

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-3-EC1: All subagents in the wave fail; post-wave sync still fires** -- Complete wave failure
  1. All subagents in the wave fail and return no commits
  2. Per section 2 UC-2-E2, the orchestrator marks the wave `failed` and presents escalation options
  3. Before or after presenting escalation, the orchestrator's post-wave `changelog-writer` invocation fires per FR-4.3
  4. The agent reads `git log` and sees no new wave commits (because none shipped). The computed `[Unreleased]` is identical to the previous state
  5. The agent returns `no-op: already in sync`
  6. The user's escalation decision is unaffected by the changelog hook

**Related FR/AC**: FR-2.6, FR-4.3, FR-4.5

### Data Requirements

- **Input**: Same as UC-2 (rule file, PRD, scratchpad, git log, existing CHANGELOG.md); plus the orchestrator's wave-completion state
- **Output**: At most one `CHANGELOG.md` rewrite per wave; structured agent summary returned to the orchestrator
- **Side Effects**: Orchestrator-only file write to `CHANGELOG.md`. No subagent-level writes to `CHANGELOG.md`. No double-write race possible (per FR-4.2).

---

## UC-4: Internal Feature -- `Changelog: skip -- internal` Excludes All Commits

**Actor**: `changelog-writer` agent
**Preconditions**:
- The project is a configured downstream project
- `docs/PRD.md` contains a PRD section whose `Changelog:` field is exactly the literal string `skip -- internal` (per FR-3.2 shape b)
- One or more commits have landed on the feature branch that map to that PRD section
- `CHANGELOG.md` may or may not exist; if it exists, it does NOT contain any entry corresponding to this PRD section

**Trigger**: The orchestrator delegates to `changelog-writer` at any lifecycle hook after one or more commits for this internal PRD section have shipped

### Primary Flow (Happy Path)

1. `changelog-writer` self-checks -- rule file present -- proceeds
2. The agent reads the inputs per FR-2.3
3. The agent parses the PRD section's `Changelog:` field and identifies the value as the literal `skip -- internal` (per FR-3.2 shape b)
4. The agent iterates over `git log` commits. Commits mapped to this PRD section are excluded from eligibility (per FR-2.4, even if they have shipped)
5. The agent computes `[Unreleased]` from ONLY the eligible (non-skip) commits across the rest of the branch
6. If no eligible commits exist anywhere on the branch AND `CHANGELOG.md` does not exist, per FR-2.8 the agent does NOT create `CHANGELOG.md`
7. If `CHANGELOG.md` exists and the computed `[Unreleased]` matches the current content (e.g., empty `[Unreleased]` or containing only entries from other non-skip PRD sections), the agent returns `no-op: already in sync`
8. The agent output summary records source counts including the skipped commits (e.g., "5 commits read, 3 eligible, 2 skipped as internal")
9. `CHANGELOG.md` is NOT modified to contain any reference to the internal PRD section -- before, during, or after the internal feature's commits land

**Postconditions**:
- `CHANGELOG.md` contains zero entries corresponding to the internal PRD section, at every point in the lifecycle
- Internal commits have shipped (they are in `git log`) but are invisible to product-facing consumers of `CHANGELOG.md`
- The agent output documents how many commits were skipped as internal

**Related FR/AC**: FR-2.4, FR-3.2 (skip value shape), FR-3.5 / AC-16

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-4-A1: Internal flipped to user-facing just before shipping (pre-flight catches up)** -- A PRD section is `Changelog: skip -- internal` through all of implementation. Before `/merge-ready`, the developer edits the PRD to a non-skip value because the work turned out to be user-facing
  1. All implementation-phase hook invocations (post-bootstrap, post-commit, post-wave) exclude the commits per UC-4 primary flow
  2. The developer edits `docs/PRD.md` to change `Changelog: skip -- internal` to `Changelog: Users can now sort the activity feed by date` (or similar non-skip value)
  3. The developer runs `/merge-ready`
  4. Before Gate 0, the pre-flight sync hook fires (per FR-4.4)
  5. `changelog-writer` re-reads the PRD (fresh read per FR-2.3), detects the now-non-skip value, and includes the previously excluded commits in `[Unreleased]`
  6. The agent rewrites `[Unreleased]` with the new entry
  7. `/merge-ready` surfaces the diff summary in its output (per FR-4.4) before proceeding to Gate 0
  8. Gate 0 and subsequent gates are unaffected; the pre-flight sync is not a gate (per FR-4.5, AC-11)

**Related FR/AC**: FR-2.3, FR-2.4, FR-4.4, FR-4.5, FR-4.6 / AC-11

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None specific to internal-skip beyond UC-2-E1 and UC-2-E2.

### Edge Cases

- **UC-4-EC1: Entire feature is internal -- `CHANGELOG.md` is never created** -- The feature branch's only PRD section is `Changelog: skip -- internal`, and no other non-skip entries exist on the branch
  1. All commits on the branch map to the internal PRD section; all are excluded (per FR-2.4)
  2. Across every hook invocation on this branch, the computed `[Unreleased]` entry set is empty
  3. If `CHANGELOG.md` did not exist before the branch started, it MUST NOT be created (per FR-2.8 and UC-1-EC1)
  4. If `CHANGELOG.md` existed before (e.g., from prior released features), it remains unchanged -- `[Unreleased]` may be empty but the file itself is valid per UC-9

**Related FR/AC**: FR-2.8

### Data Requirements

- **Input**: PRD section with `Changelog: skip -- internal`; git log containing commits for that section; rule file present
- **Output**: No entries in `[Unreleased]` for this PRD section; agent summary documents the skip count
- **Side Effects**: None to `CHANGELOG.md` caused by the internal PRD section

---

## UC-5: SDLC Repo Self-Skip -- Agent Is a Silent No-Op

**Actor**: `changelog-writer` agent, invoked while CWD is the SDLC repo itself (`claude-code-sdlc`)
**Preconditions**:
- The current working directory is the SDLC repo root (`/Users/.../claude-code-sdlc` or equivalent)
- `.claude/rules/changelog.md` does NOT exist in the SDLC repo. Per FR-1.2, the rule file lives at `templates/rules/changelog.md` and is only copied into downstream projects by `install.sh --init-project`. The SDLC repo does not install the rule on itself (per AC-2)
- The orchestrator or a pipeline command delegates to `changelog-writer` (e.g., the developer runs `/develop-feature` inside the SDLC repo to ship an iteration-2 feature of the SDLC itself)

**Trigger**: Any of the four lifecycle hooks fires `changelog-writer` while CWD is the SDLC repo

### Primary Flow (Happy Path)

1. `changelog-writer` performs the self-check: attempts to read `.claude/rules/changelog.md` at CWD (per FR-2.2)
2. The file does NOT exist -- the agent enters the "not-configured" branch
3. The agent MUST return the exact string `no-op: not configured` (per FR-2.2 literal string requirement)
4. The agent MUST NOT perform any writes (per FR-2.2)
5. The agent MUST NOT create `CHANGELOG.md` at the project root (per FR-2.2)
6. The agent MUST NOT fail the caller -- the return is success-shaped, just a no-op (per FR-2.2)
7. The calling hook treats the `no-op: not configured` response as success and continues with whatever it would have done next (per FR-4.5)

**Postconditions**:
- The SDLC repo never acquires a `CHANGELOG.md` as a side effect of running its own pipeline
- Every hook invocation inside the SDLC repo is silently a no-op
- No file writes at all
- The pipeline runs end-to-end without any changelog-related output noise
- `git status` inside the SDLC repo shows no changelog-related untracked or modified files after any pipeline run

**Related FR/AC**: FR-1.2 (rule placement under `templates/`), FR-1.4 (presence = opt-in sentinel), FR-2.2 (self-check, literal string, no writes, no failures), FR-4.5 (non-blocking hook failure guarantee extends to no-ops) / AC-2, AC-5

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-5-A1: SDLC repo becomes inadvertently "configured"** -- A developer manually copies `templates/rules/changelog.md` into `.claude/rules/changelog.md` in the SDLC repo (contrary to FR-1.2), or a bug in `install.sh` accidentally installs it on the SDLC repo itself
  1. On the next hook invocation, `changelog-writer` self-check succeeds (rule file present)
  2. The agent proceeds as in UC-1 and may create a `CHANGELOG.md` in the SDLC repo
  3. This is a misconfiguration, not an agent bug. AC-2 specifies that a correctly-installed SDLC repo MUST NOT have the rule file. Detection is by AC-2 verification, not by the agent itself
  4. Removing the rule file restores the self-skip behavior on the next invocation (stateless agent, per NFR-6)

**Related FR/AC**: FR-1.2, AC-2

### Error Flows

None. The self-check is a pure presence/absence read; if the read itself fails (e.g., permission error), the agent treats the file as absent (safest default for a "present = opt-in" sentinel) and returns `no-op: not configured`.

### Edge Cases

- **UC-5-EC1: Rule file present but empty** -- `.claude/rules/changelog.md` exists at CWD but is a zero-byte file
  1. The presence check per FR-2.2 passes (file exists). The agent proceeds as if configured
  2. The agent does not require specific content from the rule file at runtime -- the file's presence is the only sentinel (per FR-1.4)
  3. The agent proceeds to the normal input-read and sync flow per UC-1 or UC-2
  4. This is valid -- an empty rule file is still a signal that the project has opted in

**Related FR/AC**: FR-1.4, FR-2.2

### Data Requirements

- **Input**: Absence of `.claude/rules/changelog.md` at CWD
- **Output**: The exact string `no-op: not configured`
- **Side Effects**: None -- zero file reads beyond the self-check, zero file writes, zero network calls, zero errors bubbled to the caller

---

## UC-6: PRD Section Missing the `Changelog:` Field -- Runtime Tolerance

**Actor**: `changelog-writer` agent
**Preconditions**:
- The project is a configured downstream project
- `docs/PRD.md` contains at least one PRD section that is missing the `Changelog:` field entirely (not just empty -- actually absent from the section metadata)
- One or more commits on the branch map to that PRD section
- Context: this situation can occur when a PRD section was authored before the `Changelog:` field was required (NFR-2 backward compatibility), OR when a prd-writer run produces a section missing the field (authoring error that the prd-writer critic is responsible for catching per FR-3.3)

**Trigger**: Any hook invocation after a commit has landed for a PRD section lacking the `Changelog:` field

### Primary Flow (Happy Path)

1. `changelog-writer` self-checks -- rule file present -- proceeds
2. The agent reads the inputs per FR-2.3
3. The agent parses each PRD section's `Changelog:` field
4. For the offending PRD section, the agent detects that the `Changelog:` field is absent
5. Per NFR-2, the agent MUST treat missing fields as `skip -- internal` for backward compatibility (runtime tolerance) -- the agent MUST NOT fail
6. Per NFR-2, the agent MUST note the missing field in its output summary (e.g., `warning: PRD section "FeatureName" is missing a Changelog: field -- treated as skip -- internal`)
7. Commits mapped to the offending section are excluded from eligibility (per FR-2.4)
8. `[Unreleased]` is computed from the remaining eligible commits
9. The agent rewrites or returns no-op as appropriate. The pipeline is not blocked (per FR-4.5)

**Postconditions**:
- The agent completes successfully even though the PRD had an authoring gap
- `CHANGELOG.md` does NOT contain an invented user-facing description (Risk 3.9 item 4: internal work must not leak)
- The agent output surfaces the warning so the developer can correct the PRD

**Related FR/AC**: NFR-2 (runtime tolerance branch), FR-2.4, FR-2.9 (structured output including warnings), FR-3.3 (authoring strictness is the prd-writer critic's concern, not the agent's runtime concern), FR-4.5

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

None. Authoring strictness is enforced by the prd-writer agent's critic pass per FR-3.3, not by `changelog-writer` at runtime. See PRD Risk 3.9 item 4.

### Error Flows

- **UC-6-E1: Developer never corrects the missing field** -- The PRD section remains missing the `Changelog:` field through `/merge-ready`
  1. Every hook invocation treats the section as `skip -- internal` per UC-6 primary flow
  2. Every invocation's output includes the warning about the missing field
  3. The pre-flight `/merge-ready` sync also emits the warning
  4. Per FR-4.5, the pre-flight sync does NOT fail `/merge-ready` -- it is not a gate
  5. The developer may ship the feature with the field still missing; the commits are treated as internal forever
  6. If this was an authoring error (intended to be user-facing), the agent's repeated warnings are the developer's signal to correct the PRD before merge. But enforcement is out of scope for iteration 1 runtime

**Postconditions (UC-6-E1)**:
- The feature ships; internal treatment of the missing-field section is preserved
- The commits are in `git log` and the PRD exists, so a future correction (editing the PRD post-ship) could retroactively flip these commits to eligible (cf. UC-2-A2). But iteration 1 does not require such a correction

**Related FR/AC**: NFR-2, FR-3.3, FR-4.5

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-6-EC1: `Changelog:` field present but value is empty** -- E.g., `Changelog: ` with no content, or `Changelog:` on a line by itself
  1. The agent detects the field is present but the value is empty/whitespace-only
  2. The empty value matches neither valid shape (shape a: a non-empty one-line description; shape b: the literal `skip -- internal`)
  3. Per NFR-2 backward compatibility, the agent treats this as `skip -- internal` (same handling as absent field)
  4. The agent's warning in output summary distinguishes "field missing" from "field empty" so the developer can diagnose

**Related FR/AC**: NFR-2, FR-3.2

- **UC-6-EC2: `Changelog:` field present but value is not one of the two valid shapes** -- E.g., `Changelog: TODO`, `Changelog: see Jira`, `Changelog: N/A`, or any string that is neither (a) a proper user-facing description nor (b) the literal `skip -- internal`
  1. Per FR-3.2, the only valid shapes are (a) a single-line user-facing description, or (b) the exact literal string `skip -- internal`
  2. The agent cannot reliably distinguish a legit user-facing description from a malformed placeholder at runtime (it's a natural-language string); however, the agent CAN detect if the value is "not the literal `skip -- internal`" vs. "is the literal `skip -- internal`"
  3. The conservative behavior is to treat any non-literal value as shape (a) and include it in `[Unreleased]` -- this surfaces authoring errors visibly in the changelog where a product owner will see them
  4. The agent SHOULD note in output if the value looks suspiciously short, all-caps, or contains obvious placeholder markers (e.g., `TODO`, `N/A`, `FIXME`) -- but this is a soft heuristic, not a hard failure
  5. Authoring correctness is the prd-writer critic's responsibility per FR-3.3 and FR-3.4

**Related FR/AC**: FR-3.2, FR-3.3, FR-3.4

### Data Requirements

- **Input**: PRD section with missing/empty/malformed `Changelog:` field; rule file present
- **Output**: Agent summary includes a warning for each problematic PRD section; `[Unreleased]` behavior per the rules above
- **Side Effects**: No failures bubble to the caller; no pipeline blocking (per FR-4.5)

---

## UC-7: Idempotency -- Double Invocation Produces No Second Rewrite

**Actor**: `changelog-writer` agent
**Preconditions**:
- The project is a configured downstream project
- `CHANGELOG.md` exists with a correct `[Unreleased]` section matching the current eligible commit state
- No file, PRD, scratchpad, or commit changes occur between two back-to-back invocations

**Trigger**: The agent is invoked twice in succession (e.g., by two adjacent hook points, or by a test harness)

### Primary Flow (Happy Path)

1. **Invocation 1**: Agent self-checks, reads inputs, computes `[Unreleased]`, diffs against current file
2. The diff shows no content change (whitespace-insensitive per FR-2.6). Agent returns `no-op: already in sync`. No file writes
3. **Invocation 2**: Agent re-runs -- same inputs, same rule file, same commits, same PRD
4. Agent re-reads all inputs fresh per FR-2.3 (no cached state)
5. Agent re-computes `[Unreleased]`. The computed content is identical to invocation 1
6. Agent diffs against current file. The current file is byte-identical to before invocation 1 (because invocation 1 did not write)
7. Agent returns `no-op: already in sync`. No file writes
8. Both invocations' output summaries are structurally identical (possibly byte-identical except for wall-clock timestamps)

**Postconditions**:
- `CHANGELOG.md` is byte-for-byte unchanged
- The file's modification time is unchanged (no write occurred in either invocation)
- Both invocations' return codes are success
- The behavior is deterministic: inputs -> output mapping is stable

**Related FR/AC**: FR-2.6, NFR-6, NFR-7 (no network means no external state drift) / AC-6

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-7-A1: Whitespace-only difference between computed content and file content** -- Invocation 1 had actually rewritten the file; a manual edit then changed only whitespace (trailing spaces, blank-line count) without changing content
  1. Invocation 2 re-reads the file. The file differs from the computed content only in whitespace
  2. Per FR-2.6, the diff MUST be whitespace-insensitive
  3. Agent returns `no-op: already in sync` and does NOT rewrite
  4. The trailing whitespace / blank-line variation from the manual edit is preserved; the agent does not "fix" it
  5. This prevents the Risk 3.9 item 2 scenario (spurious rewrites from whitespace drift)

**Related FR/AC**: FR-2.6, NFR-6

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None.

### Edge Cases

- **UC-7-EC1: Invocation count in rapid succession** -- The same feature triggers all four hook points in quick sequence with no intervening edits (e.g., `/bootstrap-feature` followed immediately by `/merge-ready` with no slices implemented). The agent is invoked effectively four times in close succession
  1. Each invocation is independent and stateless (per NFR-6)
  2. After the first invocation (no-op or create), every subsequent invocation is a no-op
  3. Total write operations: zero or one across all four invocations
  4. Cumulative latency: within NFR-8 bounds (no-op invocations under 5s each)

**Related FR/AC**: NFR-6, NFR-8

### Data Requirements

- **Input**: Identical inputs across both invocations (file system stable between calls)
- **Output**: Both invocations return `no-op: already in sync` (except the first invocation which may return `action taken: rewrote` or `action taken: created` if the file was not yet in sync)
- **Side Effects**: Zero file writes across the second and any subsequent invocation; zero network (per NFR-7)

---

## UC-8: Manual Release Rename -- `[Unreleased]` Becomes `[X.Y.Z]`

**Actor**: Developer (manual edit) followed by `changelog-writer` agent
**Preconditions**:
- The project is a configured downstream project
- `CHANGELOG.md` exists with an `[Unreleased]` section populated with entries
- The developer has (manually, out of scope for iteration 1) decided to release the current `[Unreleased]` content as version `X.Y.Z`
- Note: iteration 1's `changelog-writer` does NOT perform the rename -- that is explicitly out of scope per PRD 3.8 item 2. The renaming is iteration 2's job. This use case documents iteration-1 behavior when a developer performs the rename manually

**Trigger**: Developer manually edits `CHANGELOG.md` to rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, then a hook invocation fires

### Primary Flow (Happy Path)

1. The developer opens `CHANGELOG.md` and renames the `[Unreleased]` heading to, e.g., `[1.3.0] - 2026-05-01`. The developer does NOT add a new `[Unreleased]` section above it. File now has `[1.3.0] - 2026-05-01` as its first post-header section, followed by the previous versioned sections
2. The developer saves the file and runs a pipeline command that fires a hook
3. `changelog-writer` self-checks, reads inputs, reads `CHANGELOG.md`
4. The agent attempts to locate the `[Unreleased]` section. It is absent
5. Per FR-2.7 (prior versioned sections remain untouched) AND the first-time-create logic in FR-2.8, the agent MUST NOT rename, touch, or overwrite the `[1.3.0]` section -- it is now a prior versioned section
6. The agent inserts a fresh empty `[Unreleased]` section immediately under the file header, ABOVE the `[1.3.0]` section. This re-establishes the persistent `[Unreleased]` convention (per design decision 7 in PRD 3.1)
7. The agent computes the current eligible entries. If no NEW eligible commits have shipped since the rename (common case -- the rename was the last action before the hook fired), the computed entry set is empty
8. With an empty computed set, the freshly inserted `[Unreleased]` section has no entries under any category (or is rendered as an empty shell, depending on Keep a Changelog style)
9. The `[1.3.0]` section content (the former `[Unreleased]` content the developer preserved) is byte-identical to before the agent ran
10. Output records `action taken: inserted empty [Unreleased]` (or `no-op: already in sync` if the file already had both `[Unreleased]` above `[1.3.0]`)

**Postconditions**:
- `CHANGELOG.md` now has `[Unreleased]` (empty or sparse) above `[1.3.0]` (the developer's manual version)
- Prior versioned sections below `[1.3.0]` are unchanged
- The content within `[1.3.0]` is byte-identical to what the developer left
- The agent has NOT performed any version rename itself -- that remains iteration 2's responsibility per PRD 3.8 item 2

**Related FR/AC**: FR-2.7 (prior versioned sections untouched), FR-2.8 (persistent `[Unreleased]` convention), design decision 7; PRD 3.8 item 2 (no automated rename in iteration 1)

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-8-A1: Developer creates both the versioned section AND a new `[Unreleased]`** -- A disciplined manual release workflow where the developer pre-creates an empty `[Unreleased]` above the renamed section
  1. Developer renames previous `[Unreleased]` -> `[1.3.0]` AND inserts a new empty `[Unreleased]` above it
  2. Agent runs, detects `[Unreleased]` is present
  3. Agent computes eligible entries -- empty if no new commits have shipped since the rename. The file's current `[Unreleased]` is also empty
  4. Agent returns `no-op: already in sync` (empty matches empty). No file writes
  5. This is the cleanest manual release workflow for iteration 1

**Related FR/AC**: FR-2.6, FR-2.7

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

None. Even if the developer's manual edit violates Keep a Changelog conventions (UC-2-E2), the agent respects the prior versioned sections byte-for-byte.

### Edge Cases

- **UC-8-EC1: New eligible commits land after the manual rename** -- The developer renamed `[Unreleased]` -> `[1.3.0]` and then resumed work on the branch with new commits for non-skip PRD sections
  1. Agent runs, finds `[Unreleased]` was inserted (by UC-8 primary flow) or is already present (UC-8-A1)
  2. Agent computes eligible entries from the full branch git log, excluding commits that are already represented in `[1.3.0]`
  3. Note: iteration 1 does NOT track which commits are already "in" a prior versioned section. The agent's source-of-truth is `git log <merge-base>..HEAD`. All commits in that range are candidates, regardless of whether they were already released
  4. To avoid double-counting commits that are already in `[1.3.0]`, the developer MUST either (a) work on a fresh branch after releasing (the typical workflow) or (b) accept that iteration 1 may list commits in both `[1.3.0]` and `[Unreleased]` if they are still in the `<merge-base>..HEAD` range. The PRD defers versioned-release-commit handling to iteration 2 -- this is a known iteration-1 limitation, not a bug
  5. The agent output summary flags the potential duplication with a warning when it detects that the same commit hash appears in a prior versioned section AND the computed `[Unreleased]`

**Related FR/AC**: FR-2.3, FR-2.7; PRD 3.8 items 2-6 (release packaging is deferred)

### Data Requirements

- **Input**: Developer-edited `CHANGELOG.md` (with renamed `[Unreleased]` -> `[X.Y.Z]`); git log; PRD; rule file
- **Output**: `CHANGELOG.md` with a fresh `[Unreleased]` above the developer's `[X.Y.Z]`; prior versioned sections byte-identical
- **Side Effects**: At most one file write to re-introduce an empty `[Unreleased]`; no modification to any versioned section

---

## UC-9: Empty `[Unreleased]` -- Valid End State When All Work Is Internal

**Actor**: `changelog-writer` agent
**Preconditions**:
- The project is a configured downstream project
- `CHANGELOG.md` exists with prior versioned sections (e.g., `[1.2.0]`, `[1.1.0]`) from earlier releases
- The current feature branch's PRD sections are ALL `Changelog: skip -- internal` -- the branch is an internal refactor/CI/type-cleanup branch with no user-facing work
- Commits have shipped on the branch; none are eligible

**Trigger**: Any hook invocation on the all-internal branch

### Primary Flow (Happy Path)

1. Agent self-checks -- configured -- proceeds
2. Agent reads inputs per FR-2.3
3. Agent iterates PRD sections; every section has `Changelog: skip -- internal`. Every commit maps to a skipped section
4. The computed eligible entries set is empty
5. Agent reads current `CHANGELOG.md`. Its `[Unreleased]` section may be empty or absent
6. If `[Unreleased]` is empty in the current file: agent returns `no-op: already in sync`
7. If `[Unreleased]` contains stale entries from a previous non-internal branch (carryover state the agent must reconcile): agent rewrites `[Unreleased]` to be empty. Prior versioned sections untouched (per FR-2.7)
8. If `[Unreleased]` is absent entirely: agent inserts an empty `[Unreleased]` section immediately under the header (per design decision 7, the persistent `[Unreleased]` convention)
9. The empty `[Unreleased]` is a valid, idiomatic Keep a Changelog end-state and MUST be preserved

**Postconditions**:
- `CHANGELOG.md` contains an empty `[Unreleased]` section (either pre-existing and left alone, or cleaned of stale entries, or newly inserted)
- Prior versioned sections are untouched
- No user-facing narrative has been invented for internal-only work
- The agent output records the rationale (`action taken: rewrote -- emptied stale entries`, `no-op: already in sync`, or `action taken: inserted empty [Unreleased]`)

**Related FR/AC**: FR-2.4, FR-2.6, FR-2.7, FR-2.8 (empty `[Unreleased]` is a valid state; the PRD only forbids creating a net-new file with zero entries, not maintaining an empty section in an existing file); design decision 7

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

None specific.

### Error Flows

None specific.

### Edge Cases

- **UC-9-EC1: Six category subheadings under an empty `[Unreleased]`** -- Some Keep a Changelog tools emit all six category subheadings (`### Added`, `### Changed`, ...) even when empty; others emit none
  1. The agent's idempotency (FR-2.6) is whitespace-insensitive
  2. Whether the current file has empty category subheadings or no subheadings under `[Unreleased]` is structurally distinct, but both represent the same content (no entries)
  3. The agent SHOULD treat both representations as equivalent for the purpose of the no-op check, rewriting only if content differs. If it rewrites, it MAY standardize on the "no empty subheadings" shape, but MUST NOT rewrite solely to change shape (that would violate FR-2.6 idempotency on subsequent calls)
  4. Acceptable iteration-1 behavior: the agent standardizes once on first rewrite and then remains idempotent thereafter

**Related FR/AC**: FR-2.6, NFR-6

### Data Requirements

- **Input**: `CHANGELOG.md` with prior versioned sections; PRD with all-skip sections; commits for all-skip work
- **Output**: `CHANGELOG.md` with an empty (but present) `[Unreleased]` section above any versioned sections
- **Side Effects**: At most one file write to empty stale content or insert the empty section

---

## UC-10: Very Large Git Log -- Tool Limitation Awareness

**Actor**: `changelog-writer` agent
**Preconditions**:
- The project is a configured downstream project
- The current branch has a very long history between `merge-base main HEAD` and `HEAD` (e.g., hundreds of commits, or a long-lived branch)
- `git log <merge-base>..HEAD` output exceeds the ~50,000-character silent-truncation threshold documented in `.claude/rules/tool-limitations.md`

**Trigger**: Any hook invocation on the large-branch scenario

### Primary Flow (Happy Path)

1. Agent self-checks -- configured -- proceeds
2. Agent attempts to read `git log <merge-base>..HEAD`
3. The output risks silent truncation (the agent receives a preview and does NOT know results were cut)
4. Per the tool-limitations rule, the agent MUST recognize when a log reads is suspiciously close to the truncation threshold or appears incomplete (e.g., ends mid-entry, total byte count within 5% of 50,000)
5. On such a signal, the agent MUST re-issue the log read with a narrower scope -- e.g., broken into smaller ranges (`git log <merge-base>..<commit-mid>` then `git log <commit-mid>..HEAD`), or with a machine-friendly format (`git log --pretty=format:'%H|%s' <merge-base>..HEAD`) that compresses output
6. The agent reconstructs the full commit set from the non-truncated chunks
7. The agent proceeds with normal eligibility computation
8. Output summary surfaces the commit count actually read so the caller can sanity-check against `git rev-list --count <merge-base>..HEAD`

**Postconditions**:
- `[Unreleased]` reflects the complete set of eligible commits, not a truncated subset
- The agent has NOT silently reported incomplete findings as complete (per tool-limitations rule)
- The commit count in the agent output matches the independently-computed `git rev-list --count <merge-base>..HEAD` value

**Related FR/AC**: FR-2.3, FR-2.4, NFR-6 (idempotency holds even under large inputs); tool-limitations.md rule (no silent truncation); PRD 3.9 Risk item 8 (fallback and annotation obligations)

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-10-A1: Initial read is within limits** -- The branch is long but the commit messages are short; total log output stays under the truncation threshold
  1. Single `git log` read returns full output
  2. Agent proceeds normally without chunking
  3. Output summary notes no truncation risk

**Related FR/AC**: FR-2.3

### Error Flows

- **UC-10-E1: Truncation not detectable** -- The agent cannot reliably detect truncation (e.g., the log happens to end cleanly at a commit boundary near the threshold)
  1. Per the tool-limitations rule, when results "seem to return fewer results than expected", the agent re-runs with tighter filters
  2. If the narrow-scope re-read produces more commits than the original, the agent detects truncation retroactively and uses the re-read output
  3. If the narrow-scope re-read produces the same commit count, the original read was complete
  4. Agent proceeds with the larger count

**Related FR/AC**: tool-limitations.md rule

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-10-EC1: Log so large that any chunking is expensive** -- Branches with thousands of commits
  1. Agent MAY fall back to reading only commit hashes and subjects (`git log --pretty=format:'%H %s'`) which reduces per-commit output bytes
  2. If full messages are needed only for eligibility decisions AND the subject line is sufficient to map a commit to a PRD section (typical case, since conventional commit scopes are in the subject), the compact form is sufficient
  3. The agent's performance envelope per NFR-8 (under 15s for rewrites) is a soft target, not a hard one, but SHOULD be honored

**Related FR/AC**: NFR-8

### Data Requirements

- **Input**: A large git log; rule file; PRD; scratchpad; CHANGELOG.md
- **Output**: Accurate `[Unreleased]` reflecting the full commit set; output summary including commit-count cross-check
- **Side Effects**: Potentially multiple `git log` invocations; single `CHANGELOG.md` write (if content changed)

---

## UC-11: Standalone `/implement-slice` -- Direct Invocation (Single-Slice Wave Path)

**Actor**: Developer invoking `/implement-slice` directly (not via `/develop-feature` orchestration) -- OR -- `/develop-feature` executing a single-slice wave through the `/implement-slice` standalone path per section 2 UC-2-A1
**Preconditions**:
- `/implement-slice` is invoked WITHOUT wave context in the spawn prompt (no wave number, no sibling slice numbers, no scratchpad-skip instruction); per section 2 UC-3-A1 this is the standalone mode
- The project is a configured downstream project
- A single slice of a feature is ready to execute per the standard TDD workflow

**Trigger**: The developer runs `/implement-slice` manually, or `/develop-feature` invokes it for a single-slice wave in standalone mode

### Primary Flow (Happy Path)

1. `/implement-slice` detects the absence of wave context in its spawn prompt -- it is in standalone mode (per section 2 UC-3-A1)
2. `/implement-slice` executes the standard TDD flow: tests first, implement, verify, commit
3. The slice's atomic commit is created with the standard commit-message format (no wave/sibling suffix)
4. Immediately after the commit succeeds, per FR-4.2 standalone branch, `/implement-slice` delegates to `changelog-writer`
5. The agent is invoked directly (not via an orchestrator layer) -- this is the use-case distinction from UC-2 and UC-3. The agent's behavior is identical because all inputs are discovered from disk (per FR-4.6)
6. `changelog-writer` self-checks -- configured -- proceeds per UC-1 or UC-2 primary flows as appropriate to the state
7. `/implement-slice` updates `.claude/scratchpad.md` with the slice result (standard standalone behavior)
8. `/implement-slice` auto-continues to the next slice or reports completion (per section 2 UC-3-A1)

**Postconditions**:
- The slice's commit is on the branch
- `CHANGELOG.md` is in sync with the post-commit state
- `.claude/scratchpad.md` is updated (standalone mode writes the scratchpad)
- No wave-level coordination occurred; this is the simple single-slice path

**Related FR/AC**: FR-4.2 (standalone branch), FR-4.6 (agent invoked with no args; inputs discovered from disk), section 2 UC-3-A1 / AC-9

**Related test case**: TC-TBD -- qa-planner will assign

### Alternative Flows

- **UC-11-A1: Slice commits with `Changelog: skip -- internal` PRD section** -- The slice covers an internal PRD section
  1. Post-commit, `changelog-writer` runs per UC-4 primary flow
  2. The commit is excluded from eligibility
  3. `CHANGELOG.md` is unchanged or returns no-op
  4. `/implement-slice` continues

**Related FR/AC**: FR-2.4, FR-4.2

**Related test case**: TC-TBD -- qa-planner will assign

### Error Flows

- **UC-11-E1: `changelog-writer` fails post-commit -- slice succeeds anyway** -- The agent crashes, times out, or returns an error after a successful slice commit
  1. Per FR-4.5, the changelog failure MUST NOT block the slice
  2. `/implement-slice` logs the error and continues
  3. The scratchpad is still updated with the slice result
  4. The failure is transient -- the next hook invocation (post-commit on the next slice, or pre-flight `/merge-ready`) re-runs the agent from scratch and catches up (per UC-3-E1 eventual-consistency pattern, NFR-6 idempotency)

**Related FR/AC**: FR-4.5, FR-4.6, NFR-6

**Related test case**: TC-TBD -- qa-planner will assign

### Edge Cases

- **UC-11-EC1: `/implement-slice` invoked in SDLC repo directly** -- The developer runs `/implement-slice` inside the SDLC repo itself (working on iteration-2 of the SDLC, for example)
  1. Post-commit, `/implement-slice` delegates to `changelog-writer` per FR-4.2 standalone branch
  2. Agent's self-check fails (per UC-5): SDLC repo has no `.claude/rules/changelog.md`
  3. Agent returns `no-op: not configured`
  4. `/implement-slice` treats this as success (per FR-4.5) and continues
  5. No CHANGELOG.md is created in the SDLC repo (per AC-2 and AC-5)

**Related FR/AC**: FR-2.2, FR-4.2, FR-4.5 / AC-2, AC-5

### Data Requirements

- **Input**: Standalone-mode spawn prompt (no wave context); rule file; PRD; scratchpad; git log; CHANGELOG.md
- **Output**: Commit + potentially a `CHANGELOG.md` rewrite + scratchpad update
- **Side Effects**: Standard slice commit; at most one `CHANGELOG.md` write; scratchpad write (standalone owns scratchpad writes, unlike parallel mode)

---

## Coverage Summary

This use-case set maps 1:1 to every FR in PRD section 3 whose behavior is observable at runtime:

- **FR-1** (rule file scoping) -> UC-1 precondition, UC-5 primary (opt-out), UC-5-EC1 (sentinel semantics)
- **FR-2.1** (agent file structure) -> verified by AC-4 at deployment time; no runtime UC
- **FR-2.2** (self-check and literal `no-op: not configured`) -> UC-5, UC-11-EC1
- **FR-2.3** (input order and fresh reads) -> UC-1, UC-2, UC-2-A1, UC-7
- **FR-2.4** (source-of-truth priority, skip exclusion) -> UC-1, UC-2, UC-2-A2, UC-2-A3, UC-3-A1, UC-4, UC-6, UC-9
- **FR-2.5** (category mapping) -> UC-1 step 7
- **FR-2.6** (idempotent diff, whitespace-insensitive) -> UC-2, UC-7, UC-7-A1
- **FR-2.7** (prior versioned sections untouched) -> UC-1-A1, UC-2-E2, UC-8, UC-9
- **FR-2.8** (first-create semantics, no empty file creation) -> UC-1, UC-1-EC1, UC-4-EC1
- **FR-2.9** (structured output summary) -> UC-1 step 10, UC-4 step 8, UC-6 step 6
- **FR-2.10** (no mutation of PRD/scratchpad) -> UC-1 step 11 (postcondition)
- **FR-3.1-3.5** (prd-writer Changelog field authoring) -> authoring-time concerns, surfaced at runtime via UC-6 and UC-6-EC1/EC2
- **FR-4.1** (post-bootstrap hook) -> UC-2 step 1-4
- **FR-4.2** (implement-slice hooks, standalone vs. subagent) -> UC-3, UC-11, UC-11-EC1
- **FR-4.3** (post-wave orchestrator hook) -> UC-3 steps 6-9, UC-3-A1, UC-3-EC1
- **FR-4.4** (merge-ready pre-flight hook, not a gate) -> UC-2 step 10-12, UC-4-A1
- **FR-4.5** (non-blocking hooks, no pass/fail gate) -> UC-2-E1, UC-2-E2, UC-3-E1, UC-6-E1, UC-11-E1
- **FR-4.6** (agent invoked with no args) -> UC-2-A1, UC-3-E1, UC-11 step 5
- **FR-5** (registration and documentation) -> deployment-time concerns verified by AC-12, AC-13; no runtime UC

And every NFR:
- **NFR-1** (no runtime code) -> architectural; not runtime-observable per use case
- **NFR-2** (backward compat, missing field tolerance) -> UC-6, UC-6-EC1, UC-6-EC2
- **NFR-3** (installer-driven activation) -> UC-5 preconditions (install path determines opt-in)
- **NFR-4** (opus model) -> deployment concern verified by AC-4
- **NFR-5** (agent count 14) -> documentation concern per AC-12, AC-13
- **NFR-6** (idempotency) -> UC-7, UC-3-E1 (eventual consistency via idempotent re-runs), UC-11-E1
- **NFR-7** (no network) -> UC-1 postcondition, UC-5 postcondition
- **NFR-8** (performance envelope) -> UC-7-EC1, UC-10-EC1

And the risk-mitigation obligations in PRD 3.9:
- Risk 1 (SDLC self-install) -> UC-5, UC-5-A1
- Risk 2 (idempotency bugs) -> UC-7, UC-7-A1
- Risk 3 (parallel double-write race) -> UC-3
- Risk 4 (internal work leaks) -> UC-4, UC-6
- Risk 8 (merge-base failure fallback) -> UC-2-E1

Scenarios discovered by the BA that are NOT explicitly enumerated in PRD section 3 but follow directly from the rules:
- **UC-6-EC2** (malformed non-literal `Changelog:` value like `TODO` / `N/A`): the PRD's FR-3.2 permits only two shapes and FR-3.4 prohibits jargon, but the agent's runtime behavior for malformed authoring was not specified. This use case proposes conservative "include and warn" behavior; qa-planner should confirm with the prd-writer whether this matches the intended design.
- **UC-8-EC1** (commits appearing in both a prior versioned section and `[Unreleased]` after a manual release rename): the PRD defers release-rename handling to iteration 2 (3.8 item 2) and does not specify how iteration 1 should avoid double-listing commits in the `<merge-base>..HEAD` range. This use case documents the known limitation; the mitigation is "work on a fresh branch after release" which is the standard Git Flow pattern.
- **UC-9** (empty `[Unreleased]` end-state for all-internal branches): the PRD specifies FR-2.8 "no empty-file creation" but does not explicitly state how an existing file's `[Unreleased]` should look when no entries are eligible. This use case specifies the "present but empty" convention as the idiomatic Keep a Changelog shape.

These three discovered edge cases are proposed behaviors consistent with the PRD; if any is incorrect, the prd-writer should clarify in PRD 3.x before the planner breaks this work into slices.
