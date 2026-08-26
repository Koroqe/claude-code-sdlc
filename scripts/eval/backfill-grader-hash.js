#!/usr/bin/env node
'use strict';

/**
 * Stamp a result file recorded before `graderHash` existed with the fingerprint
 * of the graders it was ACTUALLY run under, read from a git commit.
 *
 * history.js excludes results whose grader fingerprint does not match the case's
 * current one, because averaging runs from a corrected instrument together with
 * runs from a broken one produces a number that is wrong in the reassuring
 * direction. That exclusion also silently discards an expensive suite run that
 * merely predates the field — so this recovers those, truthfully: the hash comes
 * from the case definitions at the named commit, never from the working tree. A
 * case edited after the run therefore gets its OLD hash and stays excluded,
 * which is the correct outcome, not a limitation.
 *
 *   node scripts/eval/backfill-grader-hash.js <results-file> <commit-ish>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const [file, commit] = process.argv.slice(2);
if (!file || !commit) {
  process.stdout.write('usage: backfill-grader-hash.js <results-file> <commit-ish>\n');
  process.exit(2);
}

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
let stamped = 0;
let skipped = 0;

for (const c of doc.cases || []) {
  if (c.graderHash) { skipped += 1; continue; }
  let spec = null;
  try {
    spec = JSON.parse(execFileSync('git',
      ['show', commit + ':evals/cases/' + c.name + '/case.json'],
      { cwd: REPO_ROOT, encoding: 'utf8' }));
  } catch (err) {
    process.stdout.write('  ! ' + c.name + ' — no case definition at ' + commit + ', left unstamped\n');
    skipped += 1;
    continue;
  }
  c.graderHash = crypto.createHash('sha1')
    .update(JSON.stringify(spec.graders || [])).digest('hex').slice(0, 12);
  c.graderHashBackfilledFrom = commit;
  stamped += 1;
  process.stdout.write('  · ' + c.name + ' -> ' + c.graderHash + '\n');
}

fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
process.stdout.write(stamped + ' case(s) stamped, ' + skipped + ' left alone — ' + file + '\n');
