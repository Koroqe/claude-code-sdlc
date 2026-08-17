# Instincts

## Meta

Feature counter: 2

## Prevention Rules

## Instincts Log

### stale-cache-key-format
Confidence: 0.3
Category: general
Pattern: src/cache/keys.ts
Rule: ALWAYS derive a cache key through the shared keys.ts builder — never concatenate strings inline.
Trigger: User Correction
Occurrences: 1 (features: cache-key-collision-fix)
Last confirmed at: 2
Retires at: 12
