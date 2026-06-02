## Feature: Changelog Automation
## Branch: feat/changelog-automation
## Status: quality-gates

## Plan

Docs: docs/PRD.md §5 · docs/use-cases/changelog-automation_use_cases.md (48 scenarios) · docs/qa/changelog-automation_test_cases.md (66 TCs) · Architecture: PASS (no security pre-review)

### Wave 1 [complete]
- [x] Slice 1: New changelog rule — canonical spec (`src/rules/changelog.md`) — ebcd9b8
- [x] Slice 2: doc-updater owns CHANGELOG.md (`src/agents/doc-updater.md`) — fbaa379
- [x] Slice 3: merge-ready Finalization: Changelog Entry, non-gate (`src/commands/merge-ready.md`) — 75a9f0b
- [x] Slice 4: implement-slice standalone changelog step (`src/commands/implement-slice.md`) — d235ef9
- [x] Slice 5: CHANGELOG template + install.sh scaffold + 4→5 rule count (`templates/CHANGELOG.md`, `install.sh`) — 43a7132
- [x] Slice 6: claude.md doc — ≥3 changelog refs (`src/claude.md`) — 18f195a
- [x] Slice 7: develop-feature no-changelog flag both paths + Phase 3 note (`src/commands/develop-feature.md`) — 936e565
- [x] Slice 8: README changelog documentation (`README.md`) — 2035362

### Wave 2 [complete]
- [x] Slice 9: Installed to ~/.claude via `bash install.sh --local --yes` — all copies byte-identical, 5 rules, backup-20260602-203728

## Key design (from rule spec)
- Entry: `### <name> — <HH:MM> UTC` under `## YYYY-MM-DD` (newest day first, newest entry first). Fields: Name, date+time UTC (real `date -u`, NEVER invent), **Summary:** (non-tech), **Details:** (≤500 chars).
- Triggers (write once): merge-ready finalization (after all gates PASS) + standalone implement-slice (fix). develop-feature passes `no-changelog` flag so slices skip. Idempotency guard: same name under today → update, don't duplicate. Parallel-wave subagents never write.

## Architecture action items (folded in)
- Slice 3: author Finalization section standalone (no Section-4 "Lesson Capture" anchor — it doesn't exist).
- Slice 5: fix stale "4 rules" counts → 5 at install.sh lines ~64, ~184. README has NO literal rule count (descriptive only) — Slice 8 needs no count fix.

## Completed

## Blockers
