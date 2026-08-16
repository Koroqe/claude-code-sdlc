## Feature: Self-Improvement Loop (v4.0 roadmap F5)
## Branch: feat/self-improvement-loop-v4
## Status: blocked — weekly usage limit reached, resets 2026-08-20 20:00 Europe/Lisbon
## Tier: full

## Where this stopped

Bootstrap is **3 of 5 steps complete**. The block is an account usage limit, not a technical
problem — every remaining step (`qa-planner`, `planner`, plan-critic, the implementation slices,
and the merge-ready gates) requires spawning subagents, which is what the limit prevents.

| Step | State |
|---|---|
| 1. PRD §11 + §4 revision | **done** — committed `2b54f3f`, amended `c4140d5` + `88520ea` |
| 2. Use cases | **done** — committed `d3e41e7`, UC-1..UC-22 |
| 3. Architecture review | **done** — PASS with 10 binding constraints, all applied |
| 4. QA test cases | **not started** — blocked |
| 5. Implementation plan | **not started** — blocked |

## Resume here

1. `qa-planner` — write `docs/qa/self-improvement-loop_test_cases.md`. **It must REPLACE the existing
   file, not extend it.** That file is a v3-era artifact describing Section 4's never-implemented flat
   `lessons.md` design — 61 references to `lessons.md`, zero to instincts. The same trap already caught
   the use-case doc, which was silently stale until it was checked.
2. `planner` — 5–9 slices, wave-assigned, `**Tracer:** yes` on Wave 1 alone (literal marker — the
   colon goes **inside** the bold: `**Tracer:** yes`. Writing `**Slice 1 — Tracer: yes**` makes the
   gate inactive, which is exactly what happened on F4's first plan).
3. Plan-critic loop → implement → `/merge-ready` → changelog → merge → push → verify CI.

## Architecture verdict: PASS with 10 binding constraints — ALL APPLIED to PRD §11

- **C1** injection hardening — framing sentence only when ≥1 rule survives; rules emitted as labelled
  values not bare imperatives; `Rule:` regex capped ≤200 chars with the hook's charset; and stated
  plainly that **the regex constrains characters, not semantics**, and `Confidence:` is a relevance
  control a hostile store can simply set to 0.9 — neither is a security boundary.
- **C2** confidence precedence — the formula recomputes **only** on a new-occurrence event; decay
  persists otherwise; `Last confirmed at` pinned (capture stamps pre-increment, consolidation
  re-stamps post-increment).
- **C3** slug determinism (FR-1.5a) — **before minting a slug, scan for a matching `Pattern:` +
  `Category:` and treat a hit as a recapture.** Without this, occurrence counts fragment across
  near-duplicate headings, nothing ever elevates, and the store degrades into the flat log F5 exists
  to replace — while every mechanism still *appears* to work.
- **C4** (the sharpest) FR-6.2a — `planner` must apply FR-5.3's validation before attaching `Rule:`
  text. As drafted, FR-6 copied repo-controlled text **verbatim into a plan implementing agents then
  execute**, bypassing the whole sanitisation layer. Strictly worse than the injection path, because
  its output feeds autonomous code-writing.
- **C5** FR-7.0 — the wave result contract must require subagents to report deviation-rule fires as
  (category, count). Rule 1/2 fires are **free**, so they never appear in retry counts and the
  orchestrator learns nothing. Also reconciles FR-2.2 vs FR-2.4 thresholds.
- **C6** FR-8.9 — `debugger`'s model-profile rows must land in the **same slice** as the agent.
  `validate-model-profile.js` silently `continue`s on an unknown role, so shipping the agent alone
  doesn't fail CI — it silently exempts it from the entire drift net.
- **C7** FR-7.4 — add `.claude/instincts.md` to `pre-write-shrink-guard`'s `isCurated`. Zero collision
  (every specified mutation is `Edit`; the guard fires on `Write` only).
- **C8** FR-8.10 — if nested agent spawn is unavailable, run the diagnostic protocol inline. A
  diagnosis that cannot run degrades to a slower diagnosis, never to silence.
- **C9** FR-6.5 — cap `planner`'s Prevention Rules read at top 20 by confidence. It was the one
  unbounded consumer of a store whose size limit is instruction-enforced only.
- **C10** minor — §11.6's stale row corrected (the use-case doc is no longer §4-based; the QA doc
  still is).

## Security pre-reviews — three, two upgraded by the architect

1. **FR-5** (injection) — mandatory, already recorded
2. **FR-6** (planner attach) — mandatory, **new**: until C4 lands it is the unvalidated path, and its
   output feeds autonomous code-writing
3. **FR-8** (`debugger`) — **upgraded to mandatory**: unlike `verifier` it holds `Bash` and is
   auto-invoked exactly when its input (failing build/test output) is most attacker-influenceable

## Architect rulings — do NOT relitigate

- §7 FR-5.11 **pre-authorises** the instinct store by name, so injection is a legitimate extension.
- The per-session cost bound is real and enforced in trusted hook code.
- `debugger`'s toolset is self-consistent and needs no clock (avoids the trap that caught `verifier`).
- Section 4's in-place revision is coherent — zero live `lessons.md` references remain in `src/`,
  `README.md`, `install.sh` or `templates/`.

## Budgets

agents 14→15 of 16 · skills 7 of 10 (F5 adds none) · hooks 9 of 12 (F5 adds none — extends two)

## Blockers

- **Weekly usage limit**, resets 2026-08-20 20:00 Europe/Lisbon. Nothing else.

## Completed (v4.0 roadmap)

- F1 (§6) `6e0c55e` · F2a (§7) `cbe586d` · F2b (§8) `9cffb22` · F3 (§9) `2c7272d` ·
  defect fixes `19b29ce` · F4 (§10) `9172301`
- All merged to `main`, pushed, GitHub CI green across 4 jobs — asset-validation job now **54 steps**
  across **10 validators** (was 25 steps at F1).
