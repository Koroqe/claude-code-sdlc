#!/usr/bin/env node
'use strict';

/**
 * The context budget must FAIL on an over-ceiling tree, pinned to an exact
 * problem count — the same anti-vacuity discipline every validator here carries.
 * Trees are built in a temp dir rather than committed as a fixture: the budget
 * scores 22 components, and a committed fixture would mean 22 stub files whose
 * only job is to be the right size.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { scoreTree, CEILINGS, DEFAULT_AGENT_CEILING } = require('../../scripts/ci/validate-context-budget.js');

let failures = 0;
function ok(label, cond) {
  if (!cond) { failures += 1; process.stdout.write('  FAIL ' + label + '\n'); }
}
function equal(label, actual, expected) {
  if (actual !== expected) {
    failures += 1;
    process.stdout.write('  FAIL ' + label + ' — got ' + actual + ', expected ' + expected + '\n');
  }
}

const REPO = path.resolve(__dirname, '..', '..');

/** Build a tree where every scored component exists at `bytes` bytes. */
function buildTree(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-budget-'));
  const write = (rel, bytes) => {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'x'.repeat(bytes));
  };
  for (const [rel, ceiling] of Object.entries(CEILINGS)) {
    write(rel, (overrides && overrides[rel]) || ceiling - 100);
  }
  // Mirror the real agent inventory so the default-ceiling branch is exercised.
  for (const name of fs.readdirSync(path.join(REPO, 'agents')).filter((n) => n.endsWith('.md'))) {
    const rel = 'agents/' + name;
    if (CEILINGS[rel]) continue;
    write(rel, (overrides && overrides[rel]) || 500);
  }
  return dir;
}

// --- a compliant tree passes ---------------------------------------------
const good = buildTree();
const goodRes = scoreTree(good);
equal('a tree under every ceiling reports 0 problems', goodRes.problems.length, 0);
ok('a compliant tree still scores every component', goodRes.rows.length >= 22);

// --- SEEDED BROKEN: one oversized skill, pinned to exactly 1 problem ------
const oneOver = buildTree({ 'skills/implement-slice/SKILL.md': CEILINGS['skills/implement-slice/SKILL.md'] + 1 });
const oneRes = scoreTree(oneOver);
equal('SEEDED BROKEN — one byte over the ceiling is exactly 1 problem', oneRes.problems.length, 1);
ok('the problem names the offending file',
  oneRes.problems[0].indexOf('skills/implement-slice/SKILL.md') !== -1);
ok('the problem states the per-feature multiplier for a per-slice component',
  oneRes.problems[0].indexOf('invocations per feature') !== -1);

// --- SEEDED BROKEN: three oversized components, pinned to exactly 3 -------
const threeOver = buildTree({
  'skills/merge-ready/SKILL.md': CEILINGS['skills/merge-ready/SKILL.md'] + 5000,
  'agents/planner.md': CEILINGS['agents/planner.md'] + 1,
  'agents/code-reviewer.md': DEFAULT_AGENT_CEILING + 1,
});
equal('SEEDED BROKEN — three oversized components are exactly 3 problems',
  scoreTree(threeOver).problems.length, 3);

// --- an unscored agent is caught by the DEFAULT ceiling, not ignored ------
const bigNewAgent = buildTree({ 'agents/build-runner.md': DEFAULT_AGENT_CEILING + 1 });
equal('an agent with no explicit ceiling is still bounded by the default',
  scoreTree(bigNewAgent).problems.length, 1);

// --- anti-vacuity: a tree missing the dominant components must FAIL ------
const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-budget-empty-'));
const emptyRes = scoreTree(empty);
ok('SEEDED BROKEN — an empty tree cannot pass by measuring nothing',
  emptyRes.problems.length > 0);
ok('an empty tree trips the anti-vacuity check by name',
  emptyRes.problems.some((p) => p.indexOf('anti-vacuity') !== -1));

// --- the real repo is within budget --------------------------------------
const realRes = scoreTree(REPO);
equal('the shipped tree is within its own context budget', realRes.problems.length, 0);
ok('the shipped tree scores implement-slice as a per-slice cost',
  realRes.rows.some((r) => r.rel === 'skills/implement-slice/SKILL.md' && r.times > 1));

for (const d of [good, oneOver, threeOver, bigNewAgent, empty]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}

if (failures) {
  process.stdout.write('FAIL context budget guard — ' + failures + ' problem(s)\n');
  process.exit(1);
}
process.stdout.write('PASS context budget guard — 12 check(s)\n');
