#!/usr/bin/env node
'use strict';

/**
 * Validates that the discriminating-evidence (red-phase) contract survives.
 *
 * WHY THIS EXISTS. The harness's done-condition used to be "the tests pass".
 * That is measurably not enough: 31% of agent trajectories pass their local
 * tests without resolving the task, 23.8% of patches carry no
 * bug-discriminating evidence at all, and UTBoost found 345 patches in
 * SWE-bench itself that passed tests they should have failed
 * (`docs/findings/harness-optimization-research.md` §3). The criterion that
 * survives is a test observed FAILING before the change and passing after.
 *
 * That contract is prose spread across three files, and prose rots silently:
 * `agents/test-writer.md` must REPORT the red run, `skills/implement-slice/
 * SKILL.md` must REQUIRE and PERSIST it, and `agents/verifier.md` must TREAT
 * its absence as a Level 4 gap. Delete any one of the three and the other two
 * still read fine while the guarantee is gone. This validator is the
 * mechanical backstop for that.
 *
 * THREE ASSERTIONS, each naming the file AND the missing clause on failure:
 *
 * 1. `agents/test-writer.md` carries a red-phase reporting contract: an
 *    `## Output Format` section that asks for the command, the pre-change
 *    result, and what failed.
 * 2. `skills/implement-slice/SKILL.md` requires the red run BEFORE the
 *    implementation and persists it as a `Slice <N> red-phase:` line.
 * 3. `agents/verifier.md` treats missing/undeclared discriminating evidence
 *    as a Level 4 gap rather than accepting a test that merely exists.
 *
 * It does NOT run any test, invoke any agent, or judge whether a particular
 * slice's evidence was good. It only proves the contract is still written down.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const CORE_FILES = [
  'agents/test-writer.md',
  'skills/implement-slice/SKILL.md',
  'agents/verifier.md',
];

/** Whitespace-flattened read, so a reflow cannot break a multi-line clause. */
function flatten(text) {
  return text.replace(/\s+/g, ' ');
}

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    return null;
  }
}

function requireAll(v, file, flat, clauses) {
  for (const [needle, why] of clauses) {
    if (flat.indexOf(needle) === -1) {
      v.error(file, 'the red-phase contract lost "' + needle + '" — ' + why);
    }
  }
}

core.run('validate-red-phase-contract', (v, args) => {
  const root = args.root;

  const contents = {};
  let present = 0;
  for (const rel of CORE_FILES) {
    const text = tryRead(root, rel);
    if (text !== null) { present += 1; contents[rel] = text; }
  }

  const minimum = args.min === null ? CORE_FILES.length : args.min;
  if (!v.requireMinimum(present, minimum,
    'red-phase contract source file(s) (agents/test-writer.md, skills/implement-slice/SKILL.md, agents/verifier.md)')) {
    return;
  }

  if (contents['agents/test-writer.md']) {
    const flat = flatten(contents['agents/test-writer.md']);
    requireAll(v, 'agents/test-writer.md', flat, [
      ['## Output Format', 'without a report contract the red run is observed and then thrown away'],
      ['Red phase', 'the report must name the red phase explicitly, not bury it in prose'],
      ['Command:', 'a red phase with no command recorded cannot be re-run or checked'],
      ['Result before implementation', 'the pre-change result IS the discriminating evidence'],
    ]);
  }

  if (contents['skills/implement-slice/SKILL.md']) {
    const flat = flatten(contents['skills/implement-slice/SKILL.md']);
    requireAll(v, 'skills/implement-slice/SKILL.md', flat, [
      ['capture the RED result before', 'the run must precede the implementation or it proves nothing'],
      ['red-phase:', 'the per-slice persisted line is the durable half of the evidence'],
      ['must be declared, never silent', 'a green first run is legitimate ONLY when its reason is stated'],
    ]);
  }

  if (contents['agents/verifier.md']) {
    const flat = flatten(contents['agents/verifier.md']);
    requireAll(v, 'agents/verifier.md', flat, [
      ['discriminating evidence', 'Level 4 must distinguish a test that discriminates from one that merely exists'],
      ['red-phase', 'the verifier has to know which record to look for'],
      ['is itself a Level 4 gap', 'without this, undeclared missing evidence silently passes as VERIFIED'],
    ]);
  }
});
