#!/usr/bin/env node
'use strict';

/**
 * Pass rate per case across every recorded run — free, reads only what is on disk.
 *
 * The suite prints the result of the run you just paid for. That is the wrong
 * unit for the question people actually ask of it ("is this case reliable, or did
 * I just get a good roll?"), and answering it by memory of recent runs is how a
 * flaky case gets mistaken for a regression and a regression for flake. Sixteen
 * result files were already sitting in evals/results/ unread.
 *
 * Schema note: early result files predate multi-run cases and carry no
 * `runs`/`passedRuns`. They are counted as a single run each rather than skipped,
 * because dropping them would silently narrow the history this exists to widen.
 *
 *   node scripts/eval/history.js            # every case
 *   node scripts/eval/history.js triage-    # name prefix filter
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// Overridable so the exclusion logic can be tested against seeded result sets
// rather than trusted. The default is the real directory.
const RESULTS_DIR = process.env.SDLC_EVAL_RESULTS_DIR || path.join(REPO_ROOT, 'evals', 'results');
const CASES_DIR = process.env.SDLC_EVAL_CASES_DIR || path.join(REPO_ROOT, 'evals', 'cases');

const filter = process.argv.slice(2).find((a) => a[0] !== '-');
const allVersions = process.argv.includes('--all-grader-versions');

/**
 * The fingerprint of each case's CURRENT graders. Nine grader defects have been
 * fixed in this suite, and a run graded by a broken pattern says nothing about
 * how the harness behaves — averaging the two together produces a number that is
 * wrong in the reassuring direction. History is therefore reported for the
 * current grader version only, unless --all-grader-versions is passed.
 */
function currentHashes() {
  const crypto = require('crypto');
  const casesDir = CASES_DIR;
  const out = new Map();
  if (!fs.existsSync(casesDir)) return out;
  for (const name of fs.readdirSync(casesDir)) {
    const f = path.join(casesDir, name, 'case.json');
    if (!fs.existsSync(f)) continue;
    try {
      const spec = JSON.parse(fs.readFileSync(f, 'utf8'));
      out.set(name, crypto.createHash('sha1')
        .update(JSON.stringify(spec.graders || [])).digest('hex').slice(0, 12));
    } catch (err) { /* unreadable case: leave unmapped */ }
  }
  return out;
}
const CURRENT = currentHashes();

if (!fs.existsSync(RESULTS_DIR)) {
  process.stdout.write('no results yet — run `node scripts/eval/run-evals.js` first\n');
  process.exit(0);
}

const files = fs.readdirSync(RESULTS_DIR).filter((n) => n.endsWith('.json')).sort();
const byCase = new Map();
let malformed = 0;
let stale = 0;

for (const f of files) {
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8')); }
  catch (err) { malformed += 1; continue; }
  for (const c of (doc.cases || [])) {
    if (filter && String(c.name).indexOf(filter) !== 0) continue;
    if (!allVersions) {
      const want = CURRENT.get(c.name);
      // No fingerprint at all means the result predates this field, so it was
      // graded by patterns that have since been corrected. Excluded by default.
      if (!want || c.graderHash !== want) { stale += 1; continue; }
    }
    if (!byCase.has(c.name)) byCase.set(c.name, { runs: 0, passed: 0, errored: 0, sessions: 0, last: null });
    const acc = byCase.get(c.name);
    const runs = typeof c.runs === 'number' ? c.runs : 1;
    const passed = typeof c.passedRuns === 'number' ? c.passedRuns : (c.pass ? runs : 0);
    acc.runs += runs;
    acc.passed += passed;
    acc.errored += (c.erroredRuns || 0);
    acc.sessions += 1;
    acc.last = { at: doc.ranAt || f.replace('.json', ''), pass: Boolean(c.pass), passed, runs };
  }
}

if (byCase.size === 0) {
  if (stale) {
    process.stdout.write('no runs recorded under the CURRENT graders — ' + stale +
      ' earlier result(s) were graded by patterns that have since changed.\n' +
      'Re-run the suite, or pass --all-grader-versions to see the older numbers anyway.\n');
    process.exit(0);
  }
  process.stdout.write('no recorded runs' + (filter ? ' matching "' + filter + '"' : '') + '\n');
  process.exit(0);
}

const rows = [...byCase.entries()].sort((a, b) => (a[1].passed / a[1].runs) - (b[1].passed / b[1].runs));
process.stdout.write('case                              runs   pass   rate   inconclusive   last\n');
for (const [name, a] of rows) {
  const rate = a.runs ? (100 * a.passed / a.runs) : 0;
  process.stdout.write(
    name.padEnd(34) + String(a.runs).padStart(4) + String(a.passed).padStart(7) +
    (rate.toFixed(0) + '%').padStart(7) + String(a.errored).padStart(15) +
    ('  ' + (a.last ? a.last.passed + '/' + a.last.runs : '-')).padStart(8) + '\n');
}

const totalRuns = rows.reduce((n, [, a]) => n + a.runs, 0);
const totalPass = rows.reduce((n, [, a]) => n + a.passed, 0);
process.stdout.write('\n' + rows.length + ' case(s) over ' + files.length + ' recorded session(s): ' +
  totalPass + '/' + totalRuns + ' runs green (' + (100 * totalPass / totalRuns).toFixed(0) + '%)\n');
if (malformed) process.stdout.write(malformed + ' result file(s) unreadable and skipped\n');
if (stale) process.stdout.write(stale + ' earlier result(s) excluded — graded by patterns that have since changed' +
  ' (--all-grader-versions to include them)\n');
process.stdout.write('\nA case below 100% is either genuinely flaky or graded by a pattern that is too\n' +
  'strict. Read the grader before reading it as a harness defect — nine of this\n' +
  "suite's failures have been the instrument, and none have been a grader bug\n" +
  'that hid a real one.\n');
