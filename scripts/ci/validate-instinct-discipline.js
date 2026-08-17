#!/usr/bin/env node
'use strict';

/**
 * Validates that the higher-risk, prose-only-guarded surfaces of the
 * self-improvement-loop feature (PRD Section 11, critic W11) still carry the
 * two load-bearing clauses this feature's security pre-review approved,
 * unweakened.
 *
 * WHY THIS EXISTS (`.claude/scratchpad.md`, Slice 11). Every other mechanical
 * control this feature ships sits on the LOWER-risk path: the session-start
 * injection hook (`hooks/handlers/session-start-spine.js`) is real, tested
 * Node, and the two wave-safety guards (`pre-agent-isolation-guard.js`,
 * `pre-write-shrink-guard.js`) are real code exercised by `tests/hooks/*`.
 * The HIGHER-risk path — `planner` copying repository-controlled
 * `.claude/instincts.md` content into a PLAN that agents then EXECUTE — is
 * guarded only by prose: `agents/planner.md`'s FR-6.2a attach-time validation
 * clause, and a matching pre-capture dedup scan (C3/FR-1.5a) restated in the
 * two skill files that capture instincts. A security pre-review reads that
 * prose once, at review time; nothing mechanical stops a later, unrelated
 * edit quietly trimming a sentence and rotting the guarantee six months on.
 * This validator is that mechanical backstop — the only thing standing
 * between that prose and silent decay.
 *
 * TWO ASSERTIONS, each naming the file AND the missing/weakened clause on
 * failure — never merely "a check failed":
 *
 * 1. `agents/planner.md` carries the FR-6.2a clause unweakened: D1's
 *    allowlist framing ("containing only ... nothing else" / "Every other
 *    character fails"), the 200-character limit, "single physical line", and
 *    "excluded silently".
 * 2. BOTH capture surfaces (`skills/implement-slice/SKILL.md` and
 *    `skills/merge-ready/SKILL.md`) carry the C3/FR-1.5a pre-capture dedup
 *    clause: the "Before minting [a/any] new" slug scan, checked against
 *    BOTH `Pattern:` AND `Category:` — not either alone.
 *
 * This validator does NOT re-implement D1's regex, does NOT execute the
 * dedup scan, and does NOT invoke any agent. It only proves the prose these
 * mechanisms depend on is still present and still says what it must say.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

/**
 * Every file this validator opens for a positive-content assertion. Mirrors
 * `validate-verification-upgrade.js`'s `CORE_FILES` convention: the
 * anti-vacuity floor below is exactly this list's length, so a seeded
 * fixture missing one of them fails loudly rather than silently checking
 * fewer files than it claims to.
 */
const CORE_FILES = [
  'agents/planner.md',
  'skills/implement-slice/SKILL.md',
  'skills/merge-ready/SKILL.md',
];

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function flatten(text) {
  return text.replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// agents/planner.md — FR-6.2a's attach-time D1 validation clause
// ---------------------------------------------------------------------------
function checkPlannerFr62a(v, text) {
  const rel = 'agents/planner.md';
  const flat = flatten(text);
  // Anchor on the BOLDED requirement heading first. Anchoring on a bare
  // "FR-6.2a" takes whichever mention comes first in the file — so any prose
  // above the clause that merely names it (a header comment, a changelog note)
  // silently moves the window off the real clause and reports it as weakened.
  // That misfire was observed for real on a fixture header. Bare match stays as
  // the fallback so a clause that loses its bold markers is still found rather
  // than reported missing entirely.
  const boldIdx = flat.indexOf('**FR-6.2a');
  const markerIdx = boldIdx !== -1 ? boldIdx : flat.indexOf('FR-6.2a');
  if (markerIdx === -1) {
    v.error(
      rel,
      'FR-6.2a clause is missing entirely — no "FR-6.2a" marker found anywhere in this file. ' +
        'The attach-time D1 validation this feature\'s security pre-review approved (never attach a ' +
        '`Rule:` line that fails the shared allowlist) is gone.'
    );
    return;
  }

  // A generous window: the real clause runs roughly 900 characters from its
  // own "FR-6.2a" marker to "...repeating the disallowed text itself." A
  // narrower window would risk a false negative on cosmetic rewording; this
  // one only fails when the substantive clauses below are truly absent.
  const window = flat.slice(markerIdx, markerIdx + 1200);

  if (!window.includes('single physical line')) {
    v.error(
      rel,
      'FR-6.2a clause is weakened: the "single physical line" requirement is missing near the ' +
        'FR-6.2a marker — a multi-line `Rule:` value must be rejected, not silently accepted.'
    );
  }
  if (!window.includes('200 characters')) {
    v.error(
      rel,
      'FR-6.2a clause is weakened: the 200-character limit is missing near the FR-6.2a marker.'
    );
  }
  if (!window.includes('excluded silently')) {
    v.error(
      rel,
      'FR-6.2a clause is weakened: "excluded silently" is missing — a failing `Rule:` entry must be ' +
        'excluded silently from attachment, never truncated into shape or attached raw.'
    );
  }
  if (!window.includes('containing only') || !window.includes('nothing else')) {
    v.error(
      rel,
      'FR-6.2a clause is weakened: D1\'s allowlist framing ("containing only ... nothing else") is ' +
        'missing near the FR-6.2a marker — an allowlist rejects everything unnamed; losing this ' +
        'framing risks the clause silently degrading into a denylist of a few named characters.'
    );
  }
  if (!window.includes('Every other character fails')) {
    v.error(
      rel,
      'FR-6.2a clause is weakened: "Every other character fails" is missing near the FR-6.2a marker ' +
        '— the clause must state plainly that anything outside the allowlist is rejected.'
    );
  }
}

// ---------------------------------------------------------------------------
// C3/FR-1.5a pre-capture dedup clause — both capture surfaces
// ---------------------------------------------------------------------------
function checkDedupClause(v, rel, text) {
  const flat = flatten(text);
  const markerIdx = flat.indexOf('Before minting');
  if (markerIdx === -1) {
    v.error(
      rel,
      'C3/FR-1.5a pre-capture dedup clause is missing entirely — no "Before minting" pre-capture ' +
        'scan found. Without it, a model-minted slug can fragment the same pattern across ' +
        'near-duplicate headings and nothing ever elevates or retires.'
    );
    return;
  }

  // The real clause states the scan and its two matched fields within ~250
  // characters of "Before minting" in both files; 400 leaves headroom.
  const window = flat.slice(markerIdx, markerIdx + 400);

  if (!window.includes('`Pattern:`')) {
    v.error(
      rel,
      'C3/FR-1.5a dedup clause is weakened: the pre-capture scan near "Before minting" no longer ' +
        'names `Pattern:` as a field it matches on.'
    );
  }
  if (!window.includes('`Category:`')) {
    v.error(
      rel,
      'C3/FR-1.5a dedup clause is weakened: the pre-capture scan near "Before minting" no longer ' +
        'names `Category:` as a field it matches on.'
    );
  }
  if (!window.includes('both match')) {
    v.error(
      rel,
      'C3/FR-1.5a dedup clause is weakened: the scan no longer requires `Pattern:` AND `Category:` ' +
        'to BOTH match — an OR-matched or single-field scan would fragment occurrence counts across ' +
        'near-duplicate headings, exactly the failure mode this clause exists to prevent.'
    );
  }
}

core.run('validate-instinct-discipline', (v, args) => {
  const root = args.root;

  const contents = {};
  let presentCount = 0;
  for (const rel of CORE_FILES) {
    const text = tryRead(root, rel);
    if (text !== null) {
      presentCount += 1;
      contents[rel] = text;
    }
  }

  const minimum = args.min === null ? CORE_FILES.length : args.min;
  if (
    !v.requireMinimum(
      presentCount,
      minimum,
      'required prose-discipline source file(s) (agents/planner.md, skills/implement-slice/SKILL.md, skills/merge-ready/SKILL.md)'
    )
  ) {
    return;
  }

  if (contents['agents/planner.md']) checkPlannerFr62a(v, contents['agents/planner.md']);
  if (contents['skills/implement-slice/SKILL.md']) {
    checkDedupClause(v, 'skills/implement-slice/SKILL.md', contents['skills/implement-slice/SKILL.md']);
  }
  if (contents['skills/merge-ready/SKILL.md']) {
    checkDedupClause(v, 'skills/merge-ready/SKILL.md', contents['skills/merge-ready/SKILL.md']);
  }
});
