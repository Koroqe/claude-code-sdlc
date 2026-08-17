# Debug log: feature-beta

## Invocation 1 — Gate 5 (E2E), 2026-08-06

**Trigger:** Gate 5 attempts: 2/3, `tests/e2e/notifications/digest.e2e.test.js` failing on a
duplicate-send.

- Hypothesis 1: the digest job re-reads an already-sent notification because the "sent" flag is
  written after, not before, the send call — CONFIRMED
  - Experiment: `grep -n "markSent\|sendDigest" src/jobs/digest.ts` shows `sendDigest(...)`
    called strictly before `markSent(...)`, with no lock between them.
  - Result: confirmed — a retry between `sendDigest` and `markSent` re-sends.

**Recommended fix:** mark the notification sent BEFORE calling `sendDigest`, or wrap both in a
single transaction (Rule 3 — Auto-Resolve, a config/ordering change).
