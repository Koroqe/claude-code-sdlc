# Instincts

## Meta

Feature counter: 7

## Prevention Rules

### unlocalized-relative-time
Confidence: 0.7
Category: general
Pattern: src/lib/dateFormat.ts
Rule: ALWAYS format a relative time through the shared dateFormat helper — never inline a raw Date subtraction.
Trigger: Repeated Deviation Rule
Occurrences: 3 (features: dashboard-widget-refresh, notifications-list-redesign, activity-feed-v2)
Last confirmed at: 6
Retires at: 16

## Instincts Log
