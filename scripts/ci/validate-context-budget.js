#!/usr/bin/env node
'use strict';

/**
 * Context budget — a hard cap on what the harness charges a session to think.
 *
 * The other budgets in this repo (<=16 agents, <=10 skills, <=12 hook ids) bound
 * how many components exist. Nothing bounded how LARGE they are, and size is the
 * cost that is actually paid: a skill's full text enters the context every time
 * it is invoked.
 *
 * Why a byte ceiling rather than a token one. `claude plugin details` reports a
 * projected token cost per component, but it reads the INSTALLED plugin cache,
 * not the working tree — so it can only score a change after that change has
 * shipped, which is exactly backwards for a guard. Bytes are measurable here and
 * now, and the conversion is stable:
 *
 *   MEASURED 2026-08-26, Claude Code 2.1.237, installed 4.7.0 — working-tree
 *   bytes against the CLI's own reported on-invoke cost:
 *     merge-ready       40,617 B -> ~14.7k tok   (2.76 B/tok)
 *     develop-feature   32,444 B -> ~11.7k tok   (2.77)
 *     planner           23,437 B ->  ~8.5k tok   (2.76)
 *     implement-slice   23,176 B ->  ~8.3k tok   (2.79)
 *     verifier          17,662 B ->  ~6.4k tok   (2.76)
 *     bootstrap-feature 13,355 B ->  ~4.8k tok   (2.78)
 *     sdlc-fast         12,219 B ->  ~4.3k tok   (2.84)
 *     sdlc-quick         8,672 B ->    ~3k tok   (2.89)
 *     context-refresh    2,809 B ->   ~920 tok   (3.05)
 *   The spread at the small end is the CLI's own rounding. Across the five
 *   components that dominate the bill the ratio is 2.76-2.79.
 *
 * The multiplier that matters. Per feature, merge-ready is invoked once but
 * implement-slice is invoked once PER SLICE. At the pipeline's own 5-9 slice
 * range, implement-slice is the largest line on the bill by a wide margin, so a
 * byte added there costs ~8x a byte added to merge-ready. The report prints the
 * weighted total so that stays visible rather than having to be re-derived.
 *
 * Ceilings are set at each file's measured size plus a little headroom: growth is
 * allowed, but it has to be chosen, and raising a ceiling is a reviewable diff.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const BYTES_PER_TOKEN = 2.78;

// Times each component is invoked over one feature at the pipeline's own
// 5-9 slice range. Used for the weighted report, not for the per-file ceiling.
const SLICES_PER_FEATURE = 8;

const CEILINGS = {
  'skills/merge-ready/SKILL.md': 40000,
  'skills/develop-feature/SKILL.md': 33000,
  'skills/implement-slice/SKILL.md': 23500,
  'skills/bootstrap-feature/SKILL.md': 14000,
  'skills/sdlc-fast/SKILL.md': 12500,
  'skills/sdlc-quick/SKILL.md': 9000,
  'skills/context-refresh/SKILL.md': 3200,
  'agents/planner.md': 24000,
  'agents/verifier.md': 18000,
};
// Every other agent: none is near this today (next largest is debugger at ~9.1k).
const DEFAULT_AGENT_CEILING = 12000;

// MEASURED, not assumed: derived by reading which agents each skill actually
// invokes. `verifier` was initially listed here at one run per slice and is not
// -- it is invoked only by merge-ready's Gate 6, once per feature. That single
// wrong entry inflated the weighted total by ~44k tok, which is larger than most
// of the components on the list.
const INVOCATIONS = {
  'skills/implement-slice/SKILL.md': SLICES_PER_FEATURE,
  'agents/test-writer.md': SLICES_PER_FEATURE,   // implement-slice step 2, every slice
  'agents/build-runner.md': SLICES_PER_FEATURE,  // implement-slice step 4, every slice
};

function scoreTree(treeRoot) {
const problems = [];
const rows = [];

function score(rel, ceiling) {
  const abs = path.join(treeRoot, rel);
  if (!fs.existsSync(abs)) {
    problems.push(rel + ' — listed in the context budget but missing from the tree');
    return;
  }
  const bytes = fs.statSync(abs).size;
  const times = INVOCATIONS[rel] || 1;
  rows.push({ rel, bytes, ceiling, times, tok: Math.round(bytes / BYTES_PER_TOKEN) });
  if (bytes > ceiling) {
    problems.push(rel + ' — ' + bytes + ' bytes exceeds its ' + ceiling +
      ' byte context ceiling by ' + (bytes - ceiling) + ' (~' +
      Math.round((bytes - ceiling) / BYTES_PER_TOKEN) + ' tok' +
      (times > 1 ? ', x' + times + ' invocations per feature' : '') +
      '). Cut it, or raise the ceiling deliberately in this file.');
  }
}

for (const [rel, ceiling] of Object.entries(CEILINGS)) score(rel, ceiling);

const agentsDir = path.join(treeRoot, 'agents');
if (fs.existsSync(agentsDir)) {
  for (const name of fs.readdirSync(agentsDir).filter((n) => n.endsWith('.md')).sort()) {
    const rel = 'agents/' + name;
    if (CEILINGS[rel]) continue;
    score(rel, DEFAULT_AGENT_CEILING);
  }
}

// Anti-vacuity: this validator must be scoring the real, large components. If
// the biggest skills stopped being measured, the check would pass by measuring
// nothing at all -- the exact failure mode every other validator here guards.
const REQUIRED = ['skills/merge-ready/SKILL.md', 'skills/implement-slice/SKILL.md',
  'skills/develop-feature/SKILL.md'];
for (const rel of REQUIRED) {
  if (!rows.some((r) => r.rel === rel)) {
    problems.push('anti-vacuity: ' + rel + ' was not scored — the budget is not measuring the components that dominate it');
  }
}

return { problems, rows };
}

const { problems, rows } = scoreTree(root);

if (process.argv.includes('--report')) {
  rows.sort((a, b) => b.bytes * b.times - a.bytes * a.times);
  process.stdout.write('component                              bytes  ceiling   ~tok  x/feat   weighted\n');
  for (const r of rows) {
    process.stdout.write(
      r.rel.replace(/^(skills|agents)\//, '').replace(/\/SKILL\.md$/, '').replace(/\.md$/, '').padEnd(34) +
      String(r.bytes).padStart(8) + String(r.ceiling).padStart(9) +
      String(r.tok).padStart(7) + String(r.times).padStart(7) +
      String(r.tok * r.times).padStart(11) + '\n');
  }
  const total = rows.reduce((n, r) => n + r.tok * r.times, 0);
  process.stdout.write('\nweighted total for a ' + SLICES_PER_FEATURE +
    '-slice feature: ~' + total + ' tok of instruction text\n');
}

if (require.main === module) {
  if (problems.length) {
    process.stdout.write('FAIL context budget — ' + problems.length + ' problem(s)\n');
    for (const p of problems) process.stdout.write('  - ' + p + '\n');
    process.exit(1);
  }
  process.stdout.write('PASS context budget — ' + rows.length + ' component(s) within ceiling\n');
}

module.exports = { scoreTree, CEILINGS, DEFAULT_AGENT_CEILING, BYTES_PER_TOKEN, INVOCATIONS };
