#!/usr/bin/env node
'use strict';

/**
 * .gitignore hygiene — real `git` ignore semantics, not static grep.
 *
 * Asserts the repository's own .gitignore against the behavior git actually
 * implements (PRD §13 FR-2, TC-E1/E2/E5/E8). A static grep proved insufficient
 * twice during this feature's planning: gitignore anchoring semantics were
 * mis-assumed until measured (docs/findings/remeasurement-2.1.237.md §5 — a
 * middle-separator pattern is already root-relative; the genuinely dangerous
 * shape is a separator-free `debug/`, which matches at any depth and would
 * shadow the tracked debugger fixtures). Section B's negative control seeds
 * exactly that broken shape and requires it to MATCH — a check that only ever
 * passes is not evidence.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('gitignore hygiene');

if (process.platform === 'win32') {
  process.stdout.write('SKIP gitignore hygiene — win32 path semantics differ\n');
  process.exit(0);
}

const gitOk = spawnSync('git', ['--version'], { encoding: 'utf8' });
if (gitOk.status !== 0) {
  process.stdout.write('FAIL gitignore hygiene — git is a declared dependency and is unavailable\n');
  process.exit(1);
}

// Sandboxed git env: no user/system config can alter ignore behavior.
const sandboxHome = tempDir('sdlc-gitignore-home-');
const emptyConfig = path.join(sandboxHome, 'empty-gitconfig');
fs.writeFileSync(emptyConfig, '');
const GIT_ENV = Object.assign({}, process.env, {
  HOME: sandboxHome,
  GIT_CONFIG_GLOBAL: emptyConfig,
  GIT_CONFIG_NOSYSTEM: '1',
});

/**
 * true = ignored (exit 0), false = not ignored (exit 1), null = git error.
 * --no-index is mandatory: plain check-ignore consults the index and never
 * reports tracked files, which would make the fixture assertions vacuous.
 */
function checkIgnore(cwd, relPath) {
  const r = spawnSync('git', ['check-ignore', '--no-index', '-q', '--', relPath], {
    cwd, env: GIT_ENV, encoding: 'utf8',
  });
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  return null;
}

// --- Section A: the real .gitignore, read-only ----------------------------

const gitignoreText = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
const lines = gitignoreText.split(/\r?\n/).map((l) => l.trim());

c.equal('A1: exactly one anchored /.claude/debug/ entry',
  lines.filter((l) => l === '/.claude/debug/').length, 1);
c.ok('A2: no separator-free debug/ shape (the measured depth-shadowing form)',
  !lines.includes('debug/'), lines.join('|'));
c.ok('A2: no unanchored .claude/debug variant without trailing structure drift',
  !lines.includes('.claude/debug'), lines.join('|'));

c.equal('A3: a root wave-results path is ignored',
  checkIgnore(REPO_ROOT, '.claude/debug/wave-results/x.json'), true);

const FIXTURES = [
  'tests/fixtures/agents/debugger/second-invocation-existing-log/.claude/debug/some-feature.md',
  'tests/fixtures/agents/debugger/two-features-no-collision/feature-alpha/.claude/debug/feature-alpha.md',
  'tests/fixtures/agents/debugger/two-features-no-collision/feature-beta/.claude/debug/feature-beta.md',
];
for (const f of FIXTURES) {
  c.ok('A4: tracked fixture exists on disk: ' + path.basename(f),
    fs.existsSync(path.join(REPO_ROOT, f)));
  c.equal('A4: fixture not matched by the real .gitignore: ' + path.basename(f),
    checkIgnore(REPO_ROOT, f), false);
}

c.equal('A5: .claude/scratchpad.md stays unignored',
  checkIgnore(REPO_ROOT, '.claude/scratchpad.md'), false);
c.equal('A5: .claude/instincts.md stays unignored',
  checkIgnore(REPO_ROOT, '.claude/instincts.md'), false);

// --- Section B: hermetic temp repo, end-to-end git status semantics -------

const repo = tempDir('sdlc-gitignore-repo-');
function git(args) {
  return spawnSync('git', args, { cwd: repo, env: GIT_ENV, encoding: 'utf8' });
}
git(['init', '-q']);
git(['config', 'user.email', 'test@example.invalid']);
git(['config', 'user.name', 'gitignore-hygiene-test']);

fs.writeFileSync(path.join(repo, '.gitignore'), gitignoreText);
const waveFile = path.join(repo, '.claude/debug/wave-results');
fs.mkdirSync(waveFile, { recursive: true });
fs.writeFileSync(path.join(waveFile, 'tc-e2.json'), '{}');
const fixtureShaped = path.join(
  repo, 'tests/fixtures/agents/debugger/second-invocation-existing-log/.claude/debug'
);
fs.mkdirSync(fixtureShaped, { recursive: true });
fs.writeFileSync(path.join(fixtureShaped, 'some-feature.md'), 'fixture-shaped\n');

let status = git(['status', '--porcelain', '-uall']).stdout;
c.ok('B1: wave-results file is invisible to git status under the real .gitignore',
  status.indexOf('.claude/debug/wave-results') === -1, status);
c.ok('B1: the fixture-shaped path appears as untracked (not shadowed)',
  /\?\?.*tests\/fixtures/.test(status), status);

// Negative control: the separator-free shape MUST shadow the fixture path.
fs.writeFileSync(path.join(repo, '.gitignore'), 'debug/\n');
status = git(['status', '--porcelain', '-uall']).stdout;
c.ok('B2: under separator-free debug/ the fixture-shaped path IS shadowed (machinery can fail)',
  !/\?\?.*tests\/fixtures.*some-feature/.test(status), status);

rimraf(repo);
rimraf(sandboxHome);
c.finish();
