# Instincts

## Meta

Feature counter: 12

## Prevention Rules

## Instincts Log

### entry-from-branch-a
Confidence: 0.3
Category: general
Pattern: src/api/**
Rule: ALWAYS validate request bodies at the route boundary
Trigger: user-correction
Occurrences: 1 (features: feature-a)
Last confirmed at: 12
Retires at: 22

## Instincts Log

### entry-from-branch-b
Confidence: 0.3
Category: general
Pattern: src/jobs/**
Rule: NEVER retry a failed job without a backoff
Trigger: user-correction
Occurrences: 1 (features: feature-b)
Last confirmed at: 12
Retires at: 22
