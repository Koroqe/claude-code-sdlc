# Instincts

## Meta

Feature counter: 12
Feature counter: 14

## Prevention Rules

### auth-check-on-new-routes
Confidence: 0.5
Category: security
Pattern: src/api/**
Rule: ALWAYS apply auth middleware when adding a route under src/api
Trigger: gate-auto-fix
Occurrences: 2 (features: checkout-flow, admin-panel)
Last confirmed at: 11
Retires at: 21

## Instincts Log
