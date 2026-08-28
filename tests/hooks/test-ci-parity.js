#!/usr/bin/env node
'use strict';

/**
 * The parity script's parser is the part most likely to lie, so it is pinned to
 * the exact strings that defeated two earlier attempts at it:
 *
 *   1. A double-quoted `run:` scalar was skipped entirely by a bare-form-only
 *      regex, so the sweep reported "1 failure" when there were 2.
 *   2. The commands embed BACKTICKS (`--expect-failure "does not grant \`Bash\`"`).
 *      Run through a shell those become command substitutions; kept literal with
 *      their backslashes they fail to match the validator's message. Both
 *      produced confident, wrong output.
 *
 * A parser that silently under-reports is worse than no parser, because the
 * number it prints looks like evidence.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Checks } = require('./harness');
const { decodeScalar, tokenize, extractRunCommands, WORKFLOW } = require('../../scripts/ci/ci-parity.js');

const c = new Checks('ci parity');
const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'ci', 'ci-parity.js');

// --- scalar decoding: all three YAML forms in this workflow ---------------
c.equal('bare scalar passes through', decodeScalar('node foo.js --min 1'), 'node foo.js --min 1');
c.equal('double-quoted scalar is unwrapped and unescaped',
  decodeScalar('"node a.js --expect-failure \\"agents: Invalid input\\""'),
  'node a.js --expect-failure "agents: Invalid input"');
c.equal('single-quoted scalar is unwrapped',
  decodeScalar("'node a.js --expect-failure \"x\"'"),
  'node a.js --expect-failure "x"');
c.equal("single-quoted YAML un-doubles ''", decodeScalar("'it''s'"), "it's");

// --- tokenizing: quotes group, and the shell's escapes are consumed -------
c.equal('quoted argument stays one token',
  tokenize('node a.js --expect-failure "two words"').length, 4);
c.equal('the quoted argument keeps its spaces',
  tokenize('node a.js --expect-failure "two words"')[3], 'two words');
c.equal('SEEDED BROKEN — a backslash-escaped backtick becomes a bare backtick',
  tokenize('node a.js --expect-failure "missing field \\`effort\\`"')[3],
  'missing field `effort`');
c.equal('an escaped double quote survives inside a quoted argument',
  tokenize('node a.js --x "say \\"hi\\""')[3], 'say "hi"');
c.ok('a backtick is never executed — it is just a character',
  tokenize('node a.js --x "does not grant `Bash`"')[3].indexOf('`Bash`') !== -1);
c.equal('unquoted runs split on whitespace', tokenize('node  a.js   --min 1').length, 4);

// --- extraction over the REAL workflow ------------------------------------
const yaml = fs.readFileSync(WORKFLOW, 'utf8');
const runs = extractRunCommands(yaml);
const nodeRuns = runs.filter((r) => r.indexOf('node ') === 0);
c.ok('extracts a substantial number of run: steps', runs.length >= 60);
c.ok('finds the double-quoted plugin-manifest step a bare-form regex missed',
  nodeRuns.some((r) => r.indexOf('bad-directory-string') !== -1 &&
    r.indexOf('--expect-problems 1') !== -1));
c.ok('finds single-quoted steps too',
  nodeRuns.some((r) => r.indexOf('doc-commands/bad-broken-commands') !== -1));
c.ok('every extracted node command tokenizes to an argv starting with node',
  nodeRuns.every((r) => tokenize(r)[0] === 'node'));
c.ok('no extracted command still carries YAML quoting',
  nodeRuns.every((r) => r[0] !== '"' && r[0] !== "'"));

// --- coverage mode --------------------------------------------------------
// The script resolves its own repo root from __dirname, not cwd — so testing it
// against a seeded tree means running the COPY inside that tree. Passing the real
// script with only cwd changed silently validates the real repo and reports a
// confident pass, which is how the seeded case first "passed".
const runScript = (args, scriptPath) => {
  try {
    return { code: 0, out: execFileSync('node', [scriptPath || SCRIPT].concat(args), { cwd: REPO, encoding: 'utf8' }) };
  } catch (err) {
    return { code: err.status, out: (err.stdout || '') + (err.stderr || '') };
  }
};

const cov = runScript(['--check-coverage']);
c.equal('coverage passes on the real tree', cov.code, 0);
c.ok('coverage names how many validators it checked', /all \d+ validator\(s\)/.test(cov.out));

// SEEDED BROKEN: a validator missing from ci.yml must fail coverage. Build a
// throwaway tree whose workflow omits one validator that exists on disk.
const os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-parity-'));
fs.mkdirSync(path.join(tmp, 'scripts', 'ci'), { recursive: true });
fs.mkdirSync(path.join(tmp, '.github', 'workflows'), { recursive: true });
for (const n of fs.readdirSync(path.join(REPO, 'scripts', 'ci')).filter((n) => /^validate-.*\.js$/.test(n))) {
  fs.writeFileSync(path.join(tmp, 'scripts', 'ci', n), '// stub\n');
}
fs.copyFileSync(SCRIPT, path.join(tmp, 'scripts', 'ci', 'ci-parity.js'));
const realYaml = fs.readFileSync(WORKFLOW, 'utf8');
fs.writeFileSync(path.join(tmp, '.github', 'workflows', 'ci.yml'),
  realYaml.split('validate-context-budget.js').join('validate-NOT-WIRED-IN.js'));
const seeded = runScript(['--check-coverage'], path.join(tmp, 'scripts', 'ci', 'ci-parity.js'));
c.equal('SEEDED BROKEN — a validator absent from ci.yml fails coverage', seeded.code, 1);
c.ok('and it names the unwired validator',
  seeded.out.indexOf('validate-context-budget.js') !== -1);

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (err) { /* best effort */ }

c.finish();
