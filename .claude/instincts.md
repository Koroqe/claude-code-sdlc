# Instincts

## Meta

Feature counter: 3

## Prevention Rules

## Instincts Log

### new-channel-inherits-existing-controls
Confidence: 0.3
Category: security
Pattern: agents/design-reviewer.md
Rule: WHEN adding an execution channel gated by an existing consent mechanism, honor every kill switch and disclosure that mechanism already carries — a channel that reuses a grant silently widens it
Trigger: Gate Auto-Fix
Occurrences: 1 (features: design-capability)
Last confirmed at: 3
Retires at: 13

### prd-tracks-security-hardening
Confidence: 0.3
Category: general
Pattern: docs/PRD.md
Rule: WHEN a pre-review hardens an implementation beyond the PRD's wording, align the PRD in the same slice — otherwise Gate 7 finds the drift at merge time
Trigger: Gate Auto-Fix
Occurrences: 1 (features: design-capability)
Last confirmed at: 3
Retires at: 13

### preinstall-to-exercise-new-agent-types
Confidence: 0.3
Category: general
Pattern: agents/*.md
Rule: WHEN a feature ships a new agent or skill, exercise the registered type pre-release via a local working-tree plugin install — the old installed cache cannot dispatch a type it predates
Trigger: Gate Auto-Fix
Occurrences: 1 (features: design-capability)
Last confirmed at: 3
Retires at: 13

### consumer-contract-check-before-review
Confidence: 0.3
Category: general
Pattern: docs/qa/*_test_cases.md
Rule: WHEN authoring an artifact a validator parses, match the consumer's literal contract (exact enum strings, required framing) — decorated labels pass human eyes and fail literal matchers
Trigger: Repeated Deviation Rule
Occurrences: 1 (features: design-capability)
Last confirmed at: 3
Retires at: 13

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
