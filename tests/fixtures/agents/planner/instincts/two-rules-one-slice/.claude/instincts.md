# Instincts

## Meta

Feature counter: 6

## Prevention Rules

### missing-pagination-guard
Confidence: 0.7
Category: general
Pattern: src/routes/reports.ts
Rule: ALWAYS paginate a reports-list endpoint — never return the full unbounded result set.
Trigger: User Correction
Occurrences: 3 (features: reports-csv-export, reports-filter-ui, reports-date-range)
Last confirmed at: 5
Retires at: 15

### unvalidated-date-range-filter
Confidence: 0.5
Category: data-integrity
Pattern: src/routes/reports.ts
Rule: ALWAYS validate that a supplied date-range filter's start precedes its end before querying.
Trigger: Gate Auto-Fix
Occurrences: 2 (features: reports-filter-ui, reports-date-range)
Last confirmed at: 4
Retires at: 14

## Instincts Log
