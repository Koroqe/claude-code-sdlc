#!/usr/bin/env node
'use strict';

/**
 * The history report makes one correctness-critical decision: it excludes runs
 * graded by patterns that have since changed. If that exclusion silently stopped
 * working, the tool would average a broken instrument's failures into the
 * harness's reliability number — wrong in the reassuring direction, which is the
 * exact failure this suite keeps producing. So it is tested, not trusted.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'eval', 'history.js');

let failures = 0;
function ok(label, cond) {
  if (!cond) { failures += 1; process.stdout.write('  FAIL ' + label + '\n'); }
}

const graders = [{ name: 'g', type: 'regex', pattern: 'tier:[`*_\\s]*full' }];
const hash = crypto.createHash('sha1').update(JSON.stringify(graders)).digest('hex').slice(0, 12);

const casesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-hist-cases-'));
fs.mkdirSync(path.join(casesDir, 'demo-case'));
fs.writeFileSync(path.join(casesDir, 'demo-case', 'case.json'), JSON.stringify({ graders }));

const resultsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-hist-results-'));
const writeResult = (file, caseObj) =>
  fs.writeFileSync(path.join(resultsDir, file), JSON.stringify({ ranAt: file, cases: [caseObj] }));

// Two green runs under the CURRENT graders, plus noise that must be excluded:
// a run under a different grader version, and a legacy run with no fingerprint.
writeResult('a.json', { name: 'demo-case', pass: true, runs: 2, passedRuns: 2, graderHash: hash });
writeResult('b.json', { name: 'demo-case', pass: false, runs: 3, passedRuns: 1, graderHash: 'deadbeefcafe' });
writeResult('c.json', { name: 'demo-case', pass: false, runs: 4, passedRuns: 0 });

const run = (args) => execFileSync('node', [SCRIPT].concat(args || []), {
  encoding: 'utf8',
  env: Object.assign({}, process.env, {
    SDLC_EVAL_RESULTS_DIR: resultsDir, SDLC_EVAL_CASES_DIR: casesDir,
  }),
});

const current = run([]);
ok('counts only the runs graded by the current patterns (2/2, not 3/9)',
  /demo-case\s+2\s+2\s+100%/.test(current));
ok('SEEDED BROKEN — a stale grader version is not averaged in',
  current.indexOf('33%') === -1 && current.indexOf('22%') === -1);
ok('says how many results were excluded and why',
  /2 earlier result\(s\) excluded/.test(current));

const all = run(['--all-grader-versions']);
ok('--all-grader-versions includes them again (3/9)', /demo-case\s+9\s+3/.test(all));
ok('SEEDED BROKEN — the two views genuinely differ', current !== all);

// A results set containing ONLY stale runs must refuse to report a number.
const staleOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-hist-stale-'));
fs.writeFileSync(path.join(staleOnly, 'x.json'), JSON.stringify({
  ranAt: 'x', cases: [{ name: 'demo-case', pass: false, runs: 3, passedRuns: 0 }],
}));
const refused = execFileSync('node', [SCRIPT], {
  encoding: 'utf8',
  env: Object.assign({}, process.env, {
    SDLC_EVAL_RESULTS_DIR: staleOnly, SDLC_EVAL_CASES_DIR: casesDir,
  }),
});
ok('refuses to print a rate when every recorded run is stale',
  /no runs recorded under the CURRENT graders/.test(refused));
ok('and does not print a fabricated 0%', !/demo-case\s+3\s+0/.test(refused));

// A malformed result file must be reported, never silently dropped.
fs.writeFileSync(path.join(resultsDir, 'bad.json'), '{ not json');
ok('malformed result files are counted out loud', /unreadable and skipped/.test(run([])));

for (const d of [casesDir, resultsDir, staleOnly]) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}

if (failures) {
  process.stdout.write('FAIL eval history — ' + failures + ' problem(s)\n');
  process.exit(1);
}
process.stdout.write('PASS eval history — 8 check(s)\n');
