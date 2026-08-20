# First live end-to-end pipeline run — measured 2026-08-20

Environment: Claude Code **2.1.237** (native arm64, Apple M3), plugin **4.4.0** loaded from the
user-scope cache, memory layer refreshed to 4.4.0 at session start. This was the first session in
this repository's history in which the plugin's hooks and agents were actually loaded — everything
below is observed behaviour, not unit-test extrapolation.

The run: `/develop-feature` → 5 slices → `/merge-ready`, for PRD §12 (stale project-scope install
detection), shipped as 4.5.0. Feature branch `feat/stale-install-detection`, 7 commits + finalization.
Outcome: MERGE READY, all 9 gates (8 PASS/VERIFIED, Gate 8 N/A — no UI).

## 1. Guard fires — every one self-resolved, zero human interventions

| Guard | What happened | Self-resolvable? |
|---|---|---|
| `pre:bash:git-guard` | Refused the deliberate probe commit on `main` (Step 1 verification). | By design — the probe's purpose. |
| `pre:bash:git-guard` | Refused `docs(core):` commit type (not in `feat\|fix\|test\|chore`). | Yes — Rule 1, rewrote to `chore(core):`, free. The guard's own message names the deviation class, which made the fix mechanical. |
| `pre:agent:isolation-guard` | **Refused the `doc-updater` subagent's CHANGELOG.md write during `/merge-ready` Finalization** — the write the skill itself instructs to delegate ("Delegate the actual file write to the `doc-updater` agent"). | Yes — the blocked agent gracefully returned the composed entry and the orchestrator wrote it. But this is a genuine **skill/guard contradiction**: the guard's changelog protection does not distinguish parallel-wave subagents (the threat it was built for) from a Finalization delegation the skill mandates. Either the skill should say "compose via doc-updater, write as orchestrator," or the guard should carve out the finalization path. Until then every full-tier run hits one refusal here. |
| `pre:edit:read-guard` | **Refused an Edit to a file created by Write moments earlier in the same session** (`.claude/instincts.md` scaffold → counter increment). The guard tracks Reads but not Writes as proof of freshness. | Yes — Rule 1, Read then retry, free. False positive on the Write-then-Edit sequence; cheap to fix by counting a same-session Write as having current knowledge of the file. |

Nothing stalled. Every refusal carried an actionable message and a deviation classification, which is
exactly what made unattended self-resolution work.

## 2. `stop:gate-evidence`

Did **not** block any response in a run where gate agents genuinely ran — correct non-interference,
observed across the MERGE READY verdict turn. The blocking direction (a MERGE READY claim with no
subagent evidence) was not exercised live this run and remains unit-tested only
(`tests/hooks/test-stop-gate-evidence.js`, 17 checks).

## 3. Wave-record / cross-check (develop-feature step 1a)

- `subagent:stop:wave-record` wrote a transcript record for **every** subagent of the run (11+ across
  bootstrap, critic loops, gates) — not only wave siblings. Records carry `commands`, `files_written`,
  `tool_counts`, `tool_results_errored`, `final_text` as designed.
- The formal step-1a cross-check never executed because every wave was single-slice (same-file
  ownership forced sequential waves), and the single-slice direct path has no result-collection step.
  **The cross-check remains unexercised live.**
- **Calibration finding:** `prd-writer`'s record showed `tool_results_errored: 2` on a run that
  succeeded (transient Edit mismatches, self-corrected). Step 1a's check (b) — "`tool_results_errored`
  is 0 before treating a slice as PASS" — would have flagged a healthy slice. Benign errored tool
  results are common; the rule needs a tolerance or a distinction between fatal and recovered errors
  before the first real parallel wave relies on it.

## 4. Instinct store

Created at Finalization (Feature counter 0→1), **zero entries captured** — and that is the correct
outcome, not a silent failure: every trigger was evaluated. Trigger 1 (user correction): none
occurred. Trigger 2 (repeated deviation): tally ended `rule1=1 rule3=1`, below the 2-fire threshold.
Trigger 3 / gate captures: no gate needed an auto-fix or exhausted retries. The tally line mechanism
in the scratchpad worked (read-back before threshold decisions included).

## 5. Did anything need a human at 2am?

No. The three closest calls, all resolved autonomously:

1. **Plan-critic loops found BLOCKERs in all 3 loops** (4, 2, 2) — including a genuine PRD
   self-contradiction (§12 FR-2.2 mandated realpath-primary matching AND declared realpath failure a
   no-match). Resolved by adopting the critic's own prescribed fix (amend FR-2.2 in the implementing
   slice). Loop 3's BLOCKERs were fixable leftovers; the run proceeded with zero unresolved BLOCKERs.
2. **NFR-2's ≤30 ms latency threshold proved unmeetable** — Node 24's startup floor alone measured
   48.4 ms (the 21.4 ms-era baseline was a different environment). The threshold's own written
   fallback (record actual figure + Rule 3) prevented a dead-end; logic-only delta is ~3.6 ms.
3. **The isolation-guard/skill contradiction** at changelog finalization (above).

## 6. Other measured observations

- **Triage's Step 5 tie-break did real work:** a strict FR-1.5 reading could have classed the request
  `quick` (2–3 files); the new-untrusted-input-source ambiguity resolved it upward to `full`. First
  live classification; no misfire.
- **Live e2e probe closed the loop:** the shipped hook, run against this machine's real registry,
  emitted `stale project-scope install: project-scope 4.1.0, loaded …` — detecting the exact stale
  install that motivated the feature.
- **`develop-feature`'s Quick Tier text is stale:** it still says the tier's receiving ends "land in a
  later slice"; planner's Quick-Tier Contract, implement-slice's carve-outs and merge-ready's Tier
  Check all shipped in 4.4.0.
- **`.claude/debug/` is not gitignored** despite being described as transient — it shows as untracked
  noise in every `git status` and was flagged by two gate agents.
- **The stock macOS `/usr/bin/git` (2.x, ancient) lacks `--show-current`** — harness code should
  prefer `rev-parse --abbrev-ref HEAD` (the spine already does).
- **Version-bump-in-tracer worked:** riding the 4.5.0 bump in the first code commit kept
  `validate-release-readiness` green on every slice's unfiltered sweep (bumped-but-untagged is its
  documented pre-release OK state, line 162) — no validator was ever filtered.
- **Stale project-scope installs remain on this machine** for `booka` (4.0.0) and `Restaba` (4.1.0) —
  both non-loading versions. The new warning will surface in those projects once they update
  user-scope; the fix command is per-project.

## 7. Release phase (appended post-release)

- **`pre:bash:git-guard` refused the release push** ("Refusing an unrequested `git push`. Pushing is
  the developer's call, not the pipeline's"). The `/merge-ready` Release finalization and CLAUDE.md
  `## Release` step 3 both *require* the push — so every autonomous release will hit this refusal and
  spend a Rule 3 retry on the documented `SDLC_ALLOW_GIT_GUARD=1` override. Guard and release
  procedure disagree about whether a pipeline release push is "requested." Worth an explicit carve-out
  or an explicit statement that the override IS the intended release mechanism.
- The refusal pushed the feature's rule3 tally to 2, which correctly fired Trigger 2 — the instinct
  store's first live capture (`fixed-limits-collide-with-autonomous-runs`). Note the mechanism's
  coarseness: the two rule3 fires had unrelated root causes (latency threshold vs. push guard); the
  tally counts fires per rule, not per root cause.
- **`pre:edit:read-guard`'s Write-then-Edit false positive is systematic**: it fired a second time on
  a different file this session (a findings doc created by Write, then edited). The guard counts only
  Reads as freshness evidence.
- **Housekeeping commits on `main` now need a branch**: prior sessions committed directly to `main`
  (hooks weren't loaded); with the guard live, even post-release state bookkeeping goes through a
  branch + fast-forward merge.
- **Delivery confirmed, not assumed**: `claude plugin update` reported user scope 4.4.0→4.5.0, and
  `--scope project` fixed this repo's stale 4.1.0→4.5.0 — using exactly the command the shipped
  warning names.

## Cost profile (for future planning)

~20 subagent invocations end-to-end. Largest single consumers: planner (122k tokens), plan-critic
loops (130k + 123k + 101k), gate agents (25–108k each). The 3-loop critic pass consumed ~350k tokens
and caught the only PRD-level defect — worth it for a harness feature; possibly tunable for smaller
changes.
