# Instincts

## Meta

Feature counter: 3

## Prevention Rules

### missing-role-check-before-grant
Confidence: 0.5
Category: security
Pattern: src/admin/permissions.ts
Rule: ALWAYS validate `user.role` before granting access.
Trigger: Gate Auto-Fix
Occurrences: 2 (features: admin-role-escalation-fix, permissions-audit)
Last confirmed at: 2
Retires at: 12

## Instincts Log
