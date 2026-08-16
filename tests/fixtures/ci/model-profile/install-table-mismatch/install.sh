#!/usr/bin/env bash
# Trimmed fixture — ONLY model_for_role(), isolated from the rest of
# install.sh on purpose (PRD Section 10, FR-10.4(c)) so this fixture cannot
# rot against unrelated installer changes. scripts/ci/validate-model-profile.js
# text-parses this function body only; it never executes this file.
model_for_role() {
  local profile="$1" role="$2"
  case "${profile}:${role}" in
    quality:architect) echo opus ;;
    quality:ba-analyst) echo sonnet ;;
    quality:build-runner) echo sonnet ;;
    quality:code-reviewer) echo sonnet ;;
    quality:doc-updater) echo sonnet ;;
    quality:e2e-runner) echo sonnet ;;
    quality:plan-critic) echo opus ;;
    quality:planner) echo opus ;;
    quality:prd-writer) echo sonnet ;;
    quality:qa-planner) echo sonnet ;;
    quality:refactor-cleaner) echo sonnet ;;
    quality:security-auditor) echo opus ;;
    quality:test-writer) echo sonnet ;;
    quality:verifier) echo sonnet ;;
    balanced:architect) echo opus ;;
    balanced:ba-analyst) echo sonnet ;;
    balanced:build-runner) echo haiku ;;
    balanced:code-reviewer) echo sonnet ;;
    balanced:doc-updater) echo haiku ;;
    balanced:e2e-runner) echo sonnet ;;
    balanced:plan-critic) echo opus ;;
    balanced:planner) echo opus ;;
    balanced:prd-writer) echo haiku ;;
    balanced:qa-planner) echo sonnet ;;
    balanced:refactor-cleaner) echo sonnet ;;
    balanced:security-auditor) echo opus ;;
    balanced:test-writer) echo sonnet ;;
    balanced:verifier) echo sonnet ;;
    budget:architect) echo sonnet ;;
    budget:ba-analyst) echo sonnet ;;
    budget:build-runner) echo haiku ;;
    budget:code-reviewer) echo sonnet ;;
    budget:doc-updater) echo haiku ;;
    budget:e2e-runner) echo sonnet ;;
    budget:plan-critic) echo sonnet ;;
    budget:planner) echo sonnet ;;
    budget:prd-writer) echo haiku ;;
    budget:qa-planner) echo sonnet ;;
    budget:refactor-cleaner) echo haiku ;;
    budget:security-auditor) echo opus ;;
    budget:test-writer) echo haiku ;;
    budget:verifier) echo sonnet ;;
    inherit:*) echo inherit ;;
    *) return 1 ;;
  esac
}
