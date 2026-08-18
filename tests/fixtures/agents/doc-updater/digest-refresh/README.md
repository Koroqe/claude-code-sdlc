# Fixture: doc-updater / digest-refresh  (TC-16.2)

Identical to `digest-append/`, except the Section 11 row **already exists** and carries a deliberately
stale summary describing a design that was never built.

Expected: the existing row is refreshed **in place**. No duplicate Section 11 row appears. This is the
idempotency case — Gate 7 re-runs whenever a feature's docs are revisited, and an append-only
implementation silently accumulates one row per re-run until the index is useless.
