# Instincts

## Meta

Feature counter: 12

## Prevention Rules

### bare-console-log-instead-of-logger
Confidence: 0.90
Category: general
Pattern: src/lib/logger.ts
Rule: ALWAYS route a caught error through the shared logger — never a bare console.log call.
Trigger: User Correction
Occurrences: 1 (features: filler-feature-0-0)
Last confirmed at: 99
Retires at: 109

### unbounded-outbound-http-timeout
Confidence: 0.90
Category: security
Pattern: src/lib/httpClient.ts
Rule: ALWAYS set a request timeout on an outbound HTTP call — never leave it unbounded.
Trigger: Repeated Deviation Rule
Occurrences: 2 (features: filler-feature-1-0, filler-feature-1-1)
Last confirmed at: 98
Retires at: 108

### raw-currency-tofixed-formatting
Confidence: 0.85
Category: data-integrity
Pattern: src/lib/currency.ts
Rule: ALWAYS format a currency amount through the shared currency helper, never a raw toFixed call.
Trigger: Gate Auto-Fix
Occurrences: 3 (features: filler-feature-2-0, filler-feature-2-1, filler-feature-2-2)
Last confirmed at: 97
Retires at: 107

### stale-cart-stock-check
Confidence: 0.85
Category: general
Pattern: src/routes/orders.ts
Rule: ALWAYS re-check stock before confirming an order — never trust a stale cart snapshot.
Trigger: Gate Retry Exhausted
Occurrences: 1 (features: filler-feature-3-0)
Last confirmed at: 96
Retires at: 106

### public-endpoint-full-user-leak
Confidence: 0.80
Category: security
Pattern: src/routes/users.ts
Rule: NEVER return a full user record from a public endpoint — strip internal fields first.
Trigger: User Correction
Occurrences: 2 (features: filler-feature-4-0, filler-feature-4-1)
Last confirmed at: 95
Retires at: 105

### synchronous-transactional-email-send
Confidence: 0.80
Category: data-integrity
Pattern: src/services/emailQueue.ts
Rule: ALWAYS enqueue a transactional email — never send it synchronously in the request path.
Trigger: Repeated Deviation Rule
Occurrences: 3 (features: filler-feature-5-0, filler-feature-5-1, filler-feature-5-2)
Last confirmed at: 94
Retires at: 104

### unbounded-retry-loop
Confidence: 0.75
Category: general
Pattern: src/lib/retry.ts
Rule: ALWAYS cap a retry loop's attempts — never retry an external call unbounded.
Trigger: Gate Auto-Fix
Occurrences: 1 (features: filler-feature-6-0)
Last confirmed at: 93
Retires at: 103

### hand-rolled-slug-regex
Confidence: 0.75
Category: security
Pattern: src/lib/slugify.ts
Rule: ALWAYS derive a URL slug through the shared slugify helper, never a hand-rolled regex.
Trigger: Gate Retry Exhausted
Occurrences: 2 (features: filler-feature-7-0, filler-feature-7-1)
Last confirmed at: 92
Retires at: 102

### stale-search-index-after-edit
Confidence: 0.70
Category: data-integrity
Pattern: src/services/searchIndex.ts
Rule: ALWAYS re-index a record after an edit — never leave a stale search entry.
Trigger: User Correction
Occurrences: 3 (features: filler-feature-8-0, filler-feature-8-1, filler-feature-8-2)
Last confirmed at: 91
Retires at: 101

### hardcoded-feature-flag-boolean
Confidence: 0.70
Category: general
Pattern: src/lib/featureFlags.ts
Rule: ALWAYS read a feature flag through the shared client — never a hardcoded boolean.
Trigger: Repeated Deviation Rule
Occurrences: 1 (features: filler-feature-9-0)
Last confirmed at: 90
Retires at: 100

### unverified-webhook-signature
Confidence: 0.65
Category: security
Pattern: src/routes/webhooks.ts
Rule: ALWAYS verify a webhook's signature before processing its payload.
Trigger: Gate Auto-Fix
Occurrences: 2 (features: filler-feature-10-0, filler-feature-10-1)
Last confirmed at: 89
Retires at: 99

### hand-rolled-pagination-cursor
Confidence: 0.65
Category: data-integrity
Pattern: src/lib/pagination.ts
Rule: ALWAYS use the shared pagination helper for a list endpoint's cursor logic.
Trigger: Gate Retry Exhausted
Occurrences: 3 (features: filler-feature-11-0, filler-feature-11-1, filler-feature-11-2)
Last confirmed at: 88
Retires at: 98

### unbounded-image-resize-dimensions
Confidence: 0.60
Category: general
Pattern: src/services/imageResize.ts
Rule: ALWAYS bound an uploaded image's dimensions before resizing it.
Trigger: User Correction
Occurrences: 1 (features: filler-feature-12-0)
Last confirmed at: 87
Retires at: 97

### missing-rate-limit-on-mutation
Confidence: 0.60
Category: security
Pattern: src/lib/rateLimit.ts
Rule: ALWAYS apply the shared rate limiter to a public-facing mutation endpoint.
Trigger: Repeated Deviation Rule
Occurrences: 2 (features: filler-feature-13-0, filler-feature-13-1)
Last confirmed at: 86
Retires at: 96

### buffered-large-export-in-memory
Confidence: 0.55
Category: data-integrity
Pattern: src/routes/exports.ts
Rule: ALWAYS stream a large export — never buffer the full result set in memory.
Trigger: Gate Auto-Fix
Occurrences: 3 (features: filler-feature-14-0, filler-feature-14-1, filler-feature-14-2)
Last confirmed at: 85
Retires at: 95

### missing-idempotency-key-on-payment
Confidence: 0.55
Category: general
Pattern: src/lib/idempotencyKey.ts
Rule: ALWAYS require an idempotency key on a payment-mutating endpoint.
Trigger: Gate Retry Exhausted
Occurrences: 1 (features: filler-feature-15-0)
Last confirmed at: 84
Retires at: 94

### skipped-audit-log-on-role-change
Confidence: 0.50
Category: security
Pattern: src/services/auditLog.ts
Rule: ALWAYS write an audit-log entry for a role change — never skip it silently.
Trigger: User Correction
Occurrences: 2 (features: filler-feature-16-0, filler-feature-16-1)
Last confirmed at: 83
Retires at: 93

### invalid-date-range-before-query
Confidence: 0.50
Category: data-integrity
Pattern: src/lib/dateRange.ts
Rule: ALWAYS validate a date range's start precedes its end before querying with it.
Trigger: Repeated Deviation Rule
Occurrences: 3 (features: filler-feature-17-0, filler-feature-17-1, filler-feature-17-2)
Last confirmed at: 82
Retires at: 92

### client-only-session-invalidation
Confidence: 0.45
Category: general
Pattern: src/routes/sessions.ts
Rule: ALWAYS invalidate a session server-side on logout — never rely on the client alone.
Trigger: Gate Auto-Fix
Occurrences: 1 (features: filler-feature-18-0)
Last confirmed at: 81
Retires at: 91

### unbroken-summary-report-cache-key
Confidence: 0.45
Category: general
Pattern: src/reports/summary.ts
Rule: ALWAYS invalidate the summary report's cache entry when its underlying query window changes.
Trigger: Gate Auto-Fix
Occurrences: 3 (features: reports-summary-cache, reports-filter-ui, reports-date-range)
Last confirmed at: 80
Retires at: 90

### string-concat-csv-cell-escape
Confidence: 0.40
Category: security
Pattern: src/lib/csvEscape.ts
Rule: ALWAYS escape a CSV cell through the shared csvEscape helper — never string-concat it.
Trigger: Gate Retry Exhausted
Occurrences: 2 (features: filler-feature-19-0, filler-feature-19-1)
Last confirmed at: 79
Retires at: 89

### non-transactional-inventory-reconcile
Confidence: 0.40
Category: data-integrity
Pattern: src/services/inventorySync.ts
Rule: ALWAYS reconcile inventory counts within a transaction — never two separate writes.
Trigger: User Correction
Occurrences: 3 (features: filler-feature-20-0, filler-feature-20-1, filler-feature-20-2)
Last confirmed at: 78
Retires at: 88

### unbatched-reporting-engine-query
Confidence: 0.35
Category: data-integrity
Pattern: src/lib/reporting.ts
Rule: ALWAYS run a reporting-engine query with an explicit row-count cap — never an unbounded scan.
Trigger: Repeated Deviation Rule
Occurrences: 2 (features: reporting-engine-perf-fix, reports-summary-cache)
Last confirmed at: 77
Retires at: 87

### unchecked-password-policy
Confidence: 0.35
Category: general
Pattern: src/lib/passwordPolicy.ts
Rule: ALWAYS check a new password against the shared policy before accepting it.
Trigger: Repeated Deviation Rule
Occurrences: 1 (features: filler-feature-21-0)
Last confirmed at: 76
Retires at: 86

### empty-refund-reason-accepted
Confidence: 0.30
Category: security
Pattern: src/routes/refunds.ts
Rule: ALWAYS record the refund reason — never process a refund with an empty reason field.
Trigger: Gate Auto-Fix
Occurrences: 2 (features: filler-feature-22-0, filler-feature-22-1)
Last confirmed at: 75
Retires at: 85

## Instincts Log
