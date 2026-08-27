# Instincts

## Meta

Feature counter: 2

## Prevention Rules

## Instincts Log

### consumer-contract-check-before-review
Confidence: 0.3
Category: general
Pattern: docs/qa/*_test_cases.md
Rule: WHEN authoring an artifact a validator parses, match the consumer's literal contract (exact enum strings, required framing) — decorated labels pass human eyes and fail literal matchers
Trigger: Repeated Deviation Rule
Occurrences: 1 (features: design-capability)
Last confirmed at: 2
Retires at: 12

### manual-verification-must-be-persisted
Confidence: 0.3
Category: general
Pattern: docs/verification/
Rule: ALWAYS persist a one-off verification command as a committed test before treating the behavior as verified — a manual run that only survives as a self-report cannot be re-checked
Trigger: Gate Auto-Fix
Occurrences: 1 (features: post-live-run-reconciliation)
Last confirmed at: 2
Retires at: 12

### git-guard-chain-blindness
Confidence: 0.3
Category: general
Pattern: hooks/handlers/pre-bash-git-guard.js
Rule: WHEN a git commit or push follows a checkout in one chained Bash command, the guard evaluates the branch state before the chain runs — issue the checkout and the commit as separate calls
Trigger: Repeated Deviation Rule
Occurrences: 1 (features: post-live-run-reconciliation)
Last confirmed at: 1
Retires at: 11

### fixed-limits-collide-with-autonomous-runs
Confidence: 0.3
Category: general
Pattern: skills/merge-ready/SKILL.md
Rule: WHEN a documented pipeline step hits a fixed threshold or guard refusal, apply that mechanism's own documented fallback or override and record the measured fact, never improvise around it
Trigger: Repeated Deviation Rule
Occurrences: 1 (features: stale-install-detection)
Last confirmed at: 1
Retires at: 11
