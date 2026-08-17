# Debug log: some-feature

## Invocation 1 — Gate 4 (Build/Test), 2026-08-01

**Trigger:** Gate 4 attempts: 2/3, `tests/unit/reports/export.test.js` failing on the timestamp
comparison in the nightly-export scheduling check.

- Hypothesis 1: the export job's timestamp comparison is timezone-dependent — FALSIFIED
  - Experiment: `TZ=UTC npm test -- --grep "nightly export scheduling"` and
    `TZ=America/Los_Angeles npm test -- --grep "nightly export scheduling"` both fail identically.
  - Result: the failure reproduces under both timezones, ruling out a timezone-dependent
    comparison as the root cause.
- Hypothesis 2: the scheduler compares a `Date` object against a serialized ISO string without
  normalizing either side — CONFIRMED
  - Experiment: `grep -n "nextRunAt" src/jobs/nightlyExport.ts` showed the comparison as
    `nextRunAt > lastRunAt` where `nextRunAt` is a `Date` and `lastRunAt` is the raw string read
    from storage.
  - Result: confirmed — the comparison always evaluates true regardless of the actual times,
    because a `Date` compared against a `string` coerces to `NaN`.

**Recommended fix:** parse `lastRunAt` into a `Date` before comparing (Rule 1 — Auto-Fix, a
one-line type-correction with no behavioral ambiguity).
