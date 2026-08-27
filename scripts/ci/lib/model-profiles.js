'use strict';

/**
 * FR-8.1's model profile table, verbatim — the single JS source of truth
 * `scripts/ci/validate-model-profile.js` compares both `agents/*.md`'s
 * `model:` frontmatter and `install.sh`'s text-parsed `model_for_role()`
 * case arms against (PRD Section 10, FR-8.1, FR-10.1, FR-10.3).
 *
 * Zero dependencies (PRD Section 6, NFR-1). This file and `install.sh`'s
 * `model_for_role()` table are two independently hand-maintained copies of
 * the same data (Design Decision 6) — nothing here mechanizes keeping them
 * in sync; `scripts/ci/validate-model-profile.js` is what actually proves
 * they agree, by parsing `install.sh` as text and byte-comparing the
 * extracted triples against `TABLE` below.
 *
 * The `quality` column equals the shipped baseline (FR-8.2) — 5 `opus`
 * roles (architect, design-reviewer, plan-critic, planner, security-auditor),
 * 11 `sonnet` roles (the rest) — which is what lets an absent
 * `.sdlc-model-profile` receipt (FR-9.3) be validated identically to a
 * receipt reading `quality`.
 */

const PROFILES = ['quality', 'balanced', 'budget', 'inherit'];

const TABLE = {
  'architect': { quality: 'opus', balanced: 'opus', budget: 'sonnet', inherit: 'inherit' },
  'plan-critic': { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
  'planner': { quality: 'opus', balanced: 'opus', budget: 'sonnet', inherit: 'inherit' },
  'security-auditor': { quality: 'opus', balanced: 'opus', budget: 'opus', inherit: 'inherit' },
  'design-reviewer': { quality: 'opus', balanced: 'opus', budget: 'opus', inherit: 'inherit' },
  'ba-analyst': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
  'build-runner': { quality: 'sonnet', balanced: 'haiku', budget: 'haiku', inherit: 'inherit' },
  'code-reviewer': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
  'debugger': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
  'doc-updater': { quality: 'sonnet', balanced: 'haiku', budget: 'haiku', inherit: 'inherit' },
  'e2e-runner': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
  'prd-writer': { quality: 'sonnet', balanced: 'haiku', budget: 'haiku', inherit: 'inherit' },
  'qa-planner': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
  'refactor-cleaner': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', inherit: 'inherit' },
  'test-writer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', inherit: 'inherit' },
  'verifier': { quality: 'sonnet', balanced: 'sonnet', budget: 'sonnet', inherit: 'inherit' },
};

const ROLES = Object.keys(TABLE).sort();

/** `<profile>:<role>` -> the model FR-8.1 assigns, or `undefined` for an unknown pair. */
function modelFor(profile, role) {
  const row = TABLE[role];
  if (!row) return undefined;
  return row[profile];
}

module.exports = { PROFILES, ROLES, TABLE, modelFor };
