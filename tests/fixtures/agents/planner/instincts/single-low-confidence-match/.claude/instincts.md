# Instincts

## Meta

Feature counter: 4

## Prevention Rules

### swallowed-auth-refresh-error
Confidence: 0.5
Category: security
Pattern: src/middleware/auth.ts
Rule: NEVER swallow a token-refresh error inside auth middleware — surface it as a failed auth, never a silent pass-through.
Trigger: Gate Auto-Fix
Occurrences: 2 (features: session-timeout-fix, oauth-refresh-hardening)
Last confirmed at: 3
Retires at: 13

## Instincts Log
