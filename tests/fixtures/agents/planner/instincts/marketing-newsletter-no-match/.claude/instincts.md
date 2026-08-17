# Instincts

## Meta

Feature counter: 8

## Prevention Rules

### auth-middleware-token-check
Confidence: 0.7
Category: security
Pattern: src/middleware/auth.ts
Rule: ALWAYS verify the session token's signature before trusting any claim inside it.
Trigger: User Correction
Occurrences: 3 (features: sso-login, session-refresh-hardening, admin-impersonation-guard)
Last confirmed at: 7
Retires at: 17

### migration-backfill-batching
Confidence: 0.5
Category: data-integrity
Pattern: db/migrations/
Rule: ALWAYS run a backfilling migration in batches — never a single unbounded UPDATE.
Trigger: Gate Auto-Fix
Occurrences: 2 (features: user-table-cleanup, orders-archive-migration)
Last confirmed at: 6
Retires at: 16

## Instincts Log
