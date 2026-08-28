#!/usr/bin/env node
'use strict';

/**
 * Run locally exactly what CI runs — and prove no validator escapes CI.
 *
 * Why this exists. The sweep documented in CLAUDE.md was:
 *
 *     for v in scripts/ci/validate-*.js; do node "$v" || exit 1; done
 *
 * which invokes each validator BARE. CI additionally runs ~40 seeded-fixture
 * assertions (`--root <fixture> --expect-failure "…" --expect-problems N`) —
 * the checks this repo says are the only thing that makes a validator evidence
 * at all. So a green local sweep meant nothing about CI, and main sat red for
 * 16 consecutive runs across five releases (4.5.0-4.9.0) while every local
 * check passed. This script closes that gap by construction: it reads the
 * workflow and runs what the workflow says.
 *
 * Two traps this script exists to avoid, both hit for real while writing it:
 *
 *   1. `run:` appears in THREE YAML scalar forms here — bare, 'single-quoted',
 *      and "double-quoted with \"escaped\" inner quotes". An extractor that
 *      handled only the bare form silently skipped ci.yml's double-quoted
 *      steps and reported "1 failure" when there were 2.
 *   2. The commands contain BACKTICKS (--expect-failure "does not grant
 *      `Bash`"). Running them through a shell makes those command
 *      substitutions, which mangles the command and attributes one
 *      validator's failure to another's name. So: no shell. Commands are
 *      tokenized here and handed to execFileSync as argv.
 *
 *   node scripts/ci/ci-parity.js                  # run every CI node command
 *   node scripts/ci/ci-parity.js --check-coverage # assert no validator escapes CI
 *   node scripts/ci/ci-parity.js --list           # print what would run
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');

/** Decode one YAML scalar in the three forms this workflow actually uses. */
function decodeScalar(raw) {
  const s = raw.trim();
  if (s.length > 1 && s[0] === '"' && s[s.length - 1] === '"') {
    // Double-quoted: \" and \\ are the only escapes ci.yml uses.
    return s.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  if (s.length > 1 && s[0] === "'" && s[s.length - 1] === "'") {
    // Single-quoted YAML escapes a quote by doubling it.
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

/** Every `run:` command in the workflow, in file order. */
function extractRunCommands(yaml) {
  const out = [];
  const re = /^[ \t]*(?:-[ \t]+)?run:[ \t]*(.+?)[ \t]*$/gm;
  let m;
  while ((m = re.exec(yaml)) !== null) out.push(decodeScalar(m[1]));
  return out;
}

/**
 * Split a command line into argv. Quotes group; backticks, $, and every other
 * shell metacharacter are literal, because nothing here goes near a shell.
 */
function tokenize(cmd) {
  const argv = [];
  let cur = '';
  let quote = null;
  let started = false;
  for (let i = 0; i < cmd.length; i += 1) {
    const c = cmd[i];
    if (quote) {
      // Inside DOUBLE quotes the shell consumes a backslash before ` " \ and $.
      // ci.yml relies on this: `--expect-failure "…field \`effort\`"` reaches the
      // validator as `…field `effort``. Keeping the backslash literal made two
      // steps fail with "NOT for the expected reason" while quoting the expected
      // reason verbatim — a difference of exactly two invisible characters.
      if (quote === '"' && c === '\\' && i + 1 < cmd.length && '`"\\$'.indexOf(cmd[i + 1]) !== -1) {
        cur += cmd[i + 1];
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; started = true; continue; }
    if (c === ' ' || c === '\t') {
      if (started) { argv.push(cur); cur = ''; started = false; }
      continue;
    }
    cur += c;
    started = true;
  }
  if (started) argv.push(cur);
  return argv;
}

function main() {
  const yaml = fs.readFileSync(WORKFLOW, 'utf8');
  const allRuns = extractRunCommands(yaml);
  const nodeRuns = allRuns.filter((c) => c.indexOf('node ') === 0);

  // --- coverage mode: no validator may escape CI ----------------------------
  if (process.argv.includes('--check-coverage')) {
    const problems = [];
    const validators = fs.readdirSync(path.join(REPO_ROOT, 'scripts', 'ci'))
      .filter((n) => /^validate-.*\.js$/.test(n)).sort();
    for (const v of validators) {
      if (yaml.indexOf(v) === -1) {
        problems.push(v + ' is never referenced in .github/workflows/ci.yml — a check that runs only ' +
          'when someone remembers to run it is not a check. Add a step for it.');
      }
    }
    // Anti-vacuity: passing because nothing was discovered is not passing.
    if (validators.length < 10) {
      problems.push('anti-vacuity: only ' + validators.length + ' validator(s) discovered — the scan is not looking where the validators live');
    }
    if (problems.length) {
      process.stdout.write('FAIL ci-parity coverage — ' + problems.length + ' problem(s)\n');
      for (const p of problems) process.stdout.write('  - ' + p + '\n');
      process.exit(1);
    }
    process.stdout.write('PASS ci-parity coverage — all ' + validators.length + ' validator(s) referenced in ci.yml\n');
    process.exit(0);
  }

  if (process.argv.includes('--list')) {
    for (const c of nodeRuns) process.stdout.write('  ' + c + '\n');
    process.stdout.write(nodeRuns.length + ' node command(s) in ' + path.relative(REPO_ROOT, WORKFLOW) + '\n');
    process.exit(0);
  }

  // --- default: run them ----------------------------------------------------
  if (nodeRuns.length === 0) {
    process.stdout.write('FAIL ci-parity — no `run: node …` steps found in ' +
      path.relative(REPO_ROOT, WORKFLOW) + '. The extractor is broken, not the workflow.\n');
    process.exit(1);
  }

  const failures = [];
  for (const cmd of nodeRuns) {
    const argv = tokenize(cmd);
    try {
      execFileSync(argv[0], argv.slice(1), { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' });
      process.stdout.write('.');
    } catch (err) {
      process.stdout.write('F');
      failures.push({ cmd, out: ((err.stdout || '') + (err.stderr || '')).trim() });
    }
  }
  process.stdout.write('\n');

  for (const f of failures) {
    process.stdout.write('\nFAIL: ' + f.cmd + '\n');
    for (const line of f.out.split('\n').slice(0, 8)) process.stdout.write('  ' + line + '\n');
  }

  process.stdout.write('\n' + (nodeRuns.length - failures.length) + '/' + nodeRuns.length +
    ' CI node command(s) passed\n');
  process.exit(failures.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { decodeScalar, tokenize, extractRunCommands, WORKFLOW };
