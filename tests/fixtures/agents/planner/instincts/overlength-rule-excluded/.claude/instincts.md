# Instincts

## Meta

Feature counter: 9

## Prevention Rules

### webhook-signature-verification-verbose
Confidence: 0.7
Category: security
Pattern: src/webhooks/stripe.ts
Rule: ALWAYS verify that a webhook signature header matches the computed HMAC digest using a constant time comparison before processing any payload, and NEVER log the raw signature or the shared secret value in diagnostic output during any request cycle no
Trigger: User Correction
Occurrences: 3 (features: stripe-webhook-hardening, webhook-replay-guard, webhook-secret-rotation)
Last confirmed at: 8
Retires at: 18

## Instincts Log
