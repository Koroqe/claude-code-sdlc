#!/usr/bin/env node
'use strict';

/**
 * install.sh runtime messaging — executes the installer for real against a
 * mocked `claude` CLI, because every other check on the Slice 5 messaging
 * rewrite (PRD §13 FR-1) asserts static text and cannot catch a rewrite that
 * never prints.
 *
 * Sandbox contract, every run (security conditions M9-M11 and the loop-3
 * BLOCKER): `--local` always (without it get_source_dir performs a network
 * git clone of the PUBLISHED repo); HOME = a fresh temp dir; cwd = a fresh
 * temp project dir, NEVER the repo root (`--init-project` scaffolds into the
 * CWD and would truncate repo files); install.sh invoked by ABSOLUTE path;
 * `--profile` never passed. The mock matches on the full "$*" — matching
 * "$1 $2" yields `plugin marketplace` for `claude plugin marketplace list`,
 * short-circuits install_plugin() before the rewritten messaging, and turns
 * this whole test into a false green.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('install.sh runtime messaging');

if (process.platform === 'win32') {
  process.stdout.write('SKIP install.sh runtime messaging — bash installer, win32 skipped\n');
  process.exit(0);
}

const INSTALL = path.join(REPO_ROOT, 'install.sh');

// --- mock claude ----------------------------------------------------------
const mockDir = tempDir('sdlc-mock-claude-');
const mockLog = path.join(mockDir, 'claude-invocations.log');
fs.writeFileSync(
  path.join(mockDir, 'claude'),
  '#!/bin/sh\n' +
  'printf \'%s\\n\' "$*" >> "' + mockLog + '"\n' +
  'case "$*" in\n' +
  '  "plugin marketplace list") echo "claude-code-sdlc" ;;\n' +
  '  "plugin list") echo "claude-code-sdlc" ;;\n' +
  'esac\n' +
  'exit 0\n'
);
fs.chmodSync(path.join(mockDir, 'claude'), 0o755);

function runInstall(args) {
  const home = tempDir('sdlc-install-home-');
  const proj = tempDir('sdlc-install-proj-');
  const r = spawnSync('bash', [INSTALL].concat(args), {
    cwd: proj,
    encoding: 'utf8',
    timeout: 120000,
    env: Object.assign({}, process.env, {
      HOME: home,
      PATH: mockDir + ':' + process.env.PATH,
    }),
  });
  return { r, home, proj };
}

function snap(p) {
  const s = fs.statSync(p);
  return s.size + ':' + s.mtimeMs;
}

// Repo-untouched guard: encode the loop-3 BLOCKER hazard permanently.
const GUARDED = [
  path.join(REPO_ROOT, 'docs/PRD.md'),
  path.join(REPO_ROOT, '.claude/settings.json'),
  path.join(REPO_ROOT, '.claude/scratchpad.md'),
];
const before = GUARDED.map(snap);

// --- Run 1: real install + project scaffold -------------------------------
fs.writeFileSync(mockLog, '');
const one = runInstall(['--local', '--yes', '--init-project']);
c.ok('run1: no spawn error or timeout', one.r.error === undefined, String(one.r.error));
c.equal('run1: exit 0', one.r.status, 0);
const out = one.r.stdout || '';
c.contains('run1: optional-pinning text prints', out, 'pin a specific project to this plugin version');
c.contains('run1: Scope: user guidance prints', out, 'Scope: user');
c.contains('run1: claude plugin list guidance prints', out, 'claude plugin list');
c.ok('run1: ONE STEP LEFT is gone from runtime output', out.indexOf('ONE STEP LEFT') === -1);
c.ok('run1: no required-near-project claim in runtime output',
  !/required.{0,40}project|project.{0,40}required/i.test(out), out.slice(0, 400));

const log = fs.readFileSync(mockLog, 'utf8');
c.contains('run1: marketplace list reached (anti-false-green)', log, 'plugin marketplace list');
c.ok('run1: plugin list reached (anti-false-green)', /^plugin list$/m.test(log), log);
c.contains('run1: project-scope install still completes (TC-D6)',
  log, 'plugin install claude-code-sdlc@claude-code-sdlc --scope project');
c.contains('run1: user-scope enable still runs', log, 'plugin enable claude-code-sdlc@claude-code-sdlc');

c.ok('run1: memory layer landed in sandbox HOME',
  fs.existsSync(path.join(one.home, '.claude/CLAUDE.md')) ||
  fs.existsSync(path.join(one.home, '.claude/claude.md')));
c.ok('run1: scaffold landed in the temp project cwd',
  fs.existsSync(path.join(one.proj, 'docs')));
rimraf(one.home); rimraf(one.proj);

// --- Runs 2-4: the three --dry-run variants write nothing -----------------
const variants = [
  ['--local', '--dry-run'],
  ['--local', '--dry-run', '--init-project'],
  ['--local', '--no-plugin', '--yes', '--dry-run'],
];
for (const args of variants) {
  const v = runInstall(args);
  const label = args.join(' ');
  c.equal('dry-run exit 0: ' + label, v.r.status, 0);
  const vout = (v.r.stdout || '') + (v.r.stderr || '');
  c.ok('dry-run announces itself: ' + label, /dry.?run/i.test(vout), vout.slice(0, 200));
  c.ok('dry-run prints no ONE STEP LEFT: ' + label, vout.indexOf('ONE STEP LEFT') === -1);
  c.ok('dry-run writes no memory layer: ' + label,
    !fs.existsSync(path.join(v.home, '.claude/CLAUDE.md')) &&
    !fs.existsSync(path.join(v.home, '.claude/claude.md')));
  c.ok('dry-run scaffolds nothing into cwd: ' + label,
    !fs.existsSync(path.join(v.proj, 'docs')) && !fs.existsSync(path.join(v.proj, '.claude')));
  rimraf(v.home); rimraf(v.proj);
}

// Static cross-check + repo-untouched guard.
c.ok('static: install.sh source carries no ONE STEP LEFT',
  fs.readFileSync(INSTALL, 'utf8').indexOf('ONE STEP LEFT') === -1);
const after = GUARDED.map(snap);
for (let i = 0; i < GUARDED.length; i += 1) {
  c.equal('repo untouched: ' + path.relative(REPO_ROOT, GUARDED[i]), after[i], before[i]);
}

rimraf(mockDir);
c.finish();
