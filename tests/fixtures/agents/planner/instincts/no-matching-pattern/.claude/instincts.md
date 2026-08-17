# Instincts

## Meta

Feature counter: 5

## Prevention Rules

### unrounded-invoice-total
Confidence: 0.7
Category: data-integrity
Pattern: src/billing/invoice.ts
Rule: ALWAYS round a computed invoice total to 2 decimal places before persisting it.
Trigger: Gate Auto-Fix
Occurrences: 3 (features: invoice-pdf-export, invoice-line-items, invoice-tax-calc)
Last confirmed at: 4
Retires at: 14

### unpinned-deploy-script-version
Confidence: 0.5
Category: security
Pattern: scripts/deploy.sh
Rule: ALWAYS pin the deploy script's tool versions — never rely on whatever is latest on the runner.
Trigger: Repeated Deviation Rule
Occurrences: 2 (features: ci-runner-upgrade, deploy-script-hardening)
Last confirmed at: 3
Retires at: 13

## Instincts Log
