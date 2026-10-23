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

// Caller-seeded HOME variant. Same sandbox contract as runInstall: --local, a
// temp cwd that is never the repo root, mockDir first on PATH so the real
// `claude` CLI is never reached (including uninstall runs without --no-plugin).
function runInstallIn(home, args, extraEnv) {
  const proj = tempDir('sdlc-install-proj-');
  const r = spawnSync('bash', [INSTALL].concat(args), {
    cwd: proj,
    encoding: 'utf8',
    timeout: 120000,
    env: Object.assign({}, process.env, {
      HOME: home,
      PATH: mockDir + ':' + process.env.PATH,
    }, extraEnv || {}),
  });
  rimraf(proj);
  return r;
}

function snap(p) {
  const s = fs.statSync(p);
  return s.size + ':' + s.mtimeMs;
}

// Repo-untouched guard: encode the loop-3 BLOCKER hazard permanently.
// The per-worktree session-state file this guard used to include here was
// de-tracked and gitignored, and is now scaffolded skip-if-exists rather than
// held as a tracked repo file, so it no longer belongs in this list.
const GUARDED = [
  path.join(REPO_ROOT, 'docs/PRD.md'),
  path.join(REPO_ROOT, '.claude/settings.json'),
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
// TC-7.1: the topic-closure rule is delivered byte-identical and receipted.
{
  const shipped = path.join(REPO_ROOT, 'src/rules/topic-closure.md');
  const installed = path.join(one.home, '.claude/rules/topic-closure.md');
  c.ok('TC-7.1: installed rules/topic-closure.md exists', fs.existsSync(installed));
  c.ok('TC-7.1: installed rules/topic-closure.md is byte-identical to src',
    fs.existsSync(installed) && fs.existsSync(shipped) &&
    fs.readFileSync(installed).equals(fs.readFileSync(shipped)));
  const receiptPath = path.join(one.home, '.claude/.sdlc-receipt');
  const receipt = fs.existsSync(receiptPath) ? fs.readFileSync(receiptPath, 'utf8').split('\n') : [];
  c.ok('TC-7.1: .sdlc-receipt lists rules/topic-closure.md', receipt.indexOf('rules/topic-closure.md') !== -1,
    receipt.join('|'));
}
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

// --- TC-7.2 .. TC-7.13: rules delivery, upgrade, uninstall -------------------
{
  const SRC_RULE = path.join(REPO_ROOT, 'src/rules/topic-closure.md');
  const SRC_BYTES = fs.readFileSync(SRC_RULE);
  const BASE = ['--local', '--no-plugin', '--yes'];
  const rulesOf = function (h) { return path.join(h, '.claude', 'rules'); };
  const seedHome = function () {
    const h = tempDir('sdlc-install-home-');
    fs.mkdirSync(path.join(h, '.claude', 'rules'), { recursive: true });
    return h;
  };
  const both = function (r) { return (r.stdout || '') + (r.stderr || ''); };
  const readOr = function (f) { return fs.existsSync(f) ? fs.readFileSync(f) : null; };
  const sameBytes = function (a, b) { return a !== null && b !== null && a.equals(b); };
  const backupsOf = function (h) {
    return fs.existsSync(path.join(h, '.claude'))
      ? fs.readdirSync(path.join(h, '.claude')).filter(function (n) { return n.indexOf('backup-') === 0; })
      : [];
  };

  // TC-7.2 / TC-7.6: a user-owned rule is neither counted nor touched.
  {
    const h = seedHome();
    const mine = Buffer.from('# my own rule\nkeep me\n');
    fs.writeFileSync(path.join(rulesOf(h), 'mine.md'), mine);
    const r = runInstallIn(h, BASE);
    c.equal('TC-7.2: exit 0', r.status, 0);
    c.contains('TC-7.2: summary counts the six owned rules, not mine.md', both(r),
      '1 workflow file + 6 rules');
    c.ok('TC-7.6: mine.md byte-identical after install',
      sameBytes(readOr(path.join(rulesOf(h), 'mine.md')), mine));
    // TC-7.4: second run is idempotent.
    const r2 = runInstallIn(h, BASE);
    c.equal('TC-7.4: second run exits 0', r2.status, 0);
    c.ok('TC-7.4: rule still identical to src after second run',
      sameBytes(readOr(path.join(rulesOf(h), 'topic-closure.md')), SRC_BYTES));
    c.ok('TC-7.4: second run prints no foreign-file notice',
      both(r2).indexOf('replacing a file this installer did not place') === -1, both(r2).slice(0, 300));
    rimraf(h);
  }

  // TC-7.3: a differing hand-made copy is overwritten, backed up, and announced.
  {
    const h = seedHome();
    const handMade = Buffer.from('# hand-made topic closure\nmine, not yours\n');
    fs.writeFileSync(path.join(rulesOf(h), 'topic-closure.md'), handMade);
    const r = runInstallIn(h, BASE);
    c.equal('TC-7.3: exit 0', r.status, 0);
    c.ok('TC-7.3: installed copy is the plugin version',
      sameBytes(readOr(path.join(rulesOf(h), 'topic-closure.md')), SRC_BYTES));
    const bks = backupsOf(h);
    c.ok('TC-7.3: a backup directory exists', bks.length >= 1, bks.join(','));
    c.ok('TC-7.3: a backup holds the hand-made bytes',
      bks.some(function (b) {
        return sameBytes(readOr(path.join(h, '.claude', b, 'rules', 'topic-closure.md')), handMade);
      }));
    const copies = fs.readdirSync(rulesOf(h)).filter(function (n) { return n === 'topic-closure.md'; });
    c.equal('TC-7.3: exactly one installed copy', copies.length, 1);
    c.contains('MEDIUM-7: notice names the replaced foreign file', both(r),
      'replacing a file this installer did not place');
    c.contains('MEDIUM-7: notice names the entry', both(r), 'rules/topic-closure.md');
    c.ok('MEDIUM-7: nothing inside rules/ other than owned files was created',
      fs.readdirSync(rulesOf(h)).every(function (n) { return /^[a-z-]+\.md$/.test(n); }));
    rimraf(h);
  }

  // MEDIUM-7 retention wording: the notice states the EFFECTIVE keep count and
  // never echoes a raw SDLC_KEEP_BACKUPS value.
  {
    const mk = function () {
      const h = seedHome();
      fs.writeFileSync(path.join(rulesOf(h), 'topic-closure.md'), '# hand-made\n');
      return h;
    };
    let h = mk();
    let r = runInstallIn(h, BASE, { SDLC_KEEP_BACKUPS: '0' });
    c.contains('LOW: SDLC_KEEP_BACKUPS=0 notice says never pruned', both(r), 'never pruned');
    c.ok('LOW: SDLC_KEEP_BACKUPS=0 notice does not claim pruning',
      both(r).indexOf('pruned after') === -1, both(r).slice(0, 400));
    rimraf(h);
    h = mk();
    r = runInstallIn(h, BASE, { SDLC_KEEP_BACKUPS: 'abc$(x)' });
    c.contains('LOW: non-numeric SDLC_KEEP_BACKUPS notice says never pruned', both(r), 'never pruned');
    c.ok('LOW: raw env value is never echoed', both(r).indexOf('abc$(x)') === -1, both(r).slice(0, 400));
    rimraf(h);
    h = mk();
    r = runInstallIn(h, BASE, { SDLC_KEEP_BACKUPS: '3' });
    c.contains('LOW: SDLC_KEEP_BACKUPS=3 notice says pruned after 3 newer ones', both(r), 'pruned after 3 newer ones');
    rimraf(h);
    h = mk();
    const envNoKeep = Object.assign({}, process.env); delete envNoKeep.SDLC_KEEP_BACKUPS;
    r = runInstallIn(h, BASE, { SDLC_KEEP_BACKUPS: '' });
    c.contains('LOW: empty SDLC_KEEP_BACKUPS falls back to the default 5', both(r), 'pruned after 5 newer ones');
    rimraf(h);
  }

  // TC-7.5: upgrade from a seeded 4.11.2 install (claude.md + five rules + receipt).
  {
    const h = seedHome();
    const five = ['changelog', 'error-recovery', 'git', 'scratchpad', 'tool-limitations'];
    fs.writeFileSync(path.join(h, '.claude', 'claude.md'), 'old claude.md\n');
    five.forEach(function (n) { fs.writeFileSync(path.join(rulesOf(h), n + '.md'), 'old ' + n + '\n'); });
    fs.writeFileSync(path.join(h, '.claude', '.sdlc-receipt'),
      '4.11.2\nclaude.md\n' + five.map(function (n) { return 'rules/' + n + '.md\n'; }).join(''));
    const r = runInstallIn(h, BASE);
    c.equal('TC-7.5: exit 0', r.status, 0);
    c.ok('TC-7.5: topic-closure.md installed by the upgrade',
      sameBytes(readOr(path.join(rulesOf(h), 'topic-closure.md')), SRC_BYTES));
    c.contains('TC-7.5: summary reports 6 rules', both(r), '1 workflow file + 6 rules');
    c.ok('TC-7.5: no foreign-file notice for receipted files',
      both(r).indexOf('replacing a file this installer did not place') === -1, both(r).slice(0, 400));
    rimraf(h);
  }

  // TC-7.7: an unwritable rules/ fails loudly.
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    process.stdout.write('SKIP TC-7.7 — running as root, permission bits do not bind\n');
  } else {
    const h = seedHome();
    fs.chmodSync(rulesOf(h), 0o555);
    const r = runInstallIn(h, BASE);
    fs.chmodSync(rulesOf(h), 0o755);
    c.ok('TC-7.7: non-zero exit when rules/ is not writable', r.status !== 0, 'status ' + r.status);
    c.ok('TC-7.7: no success line printed',
      both(r).indexOf('Memory layer installed') === -1, both(r).slice(0, 300));
    rimraf(h);
  }

  // TC-7.8 / 7.9 / 7.12: uninstall after an install, mine.md and other.md survive.
  // The uninstall runs omit --no-plugin on purpose: the mock claude must absorb it.
  {
    const h = seedHome();
    fs.writeFileSync(path.join(rulesOf(h), 'mine.md'), 'mine\n');
    fs.writeFileSync(path.join(rulesOf(h), 'other.md'), 'other\n');
    const inst = runInstallIn(h, BASE);
    c.equal('TC-7.8: setup install exit 0', inst.status, 0);
    fs.appendFileSync(path.join(rulesOf(h), 'topic-closure.md'), '\nhand edit\n');
    const un = runInstallIn(h, ['--local', '--yes', '--uninstall']);
    c.equal('TC-7.8: uninstall exit 0', un.status, 0);
    c.ok('TC-7.8/7.9: rule removed even though hand-edited',
      !fs.existsSync(path.join(rulesOf(h), 'topic-closure.md')));
    c.ok('TC-7.8: mine.md kept', fs.existsSync(path.join(rulesOf(h), 'mine.md')));
    c.ok('TC-7.12: mine.md and other.md survive',
      fs.existsSync(path.join(rulesOf(h), 'mine.md')) && fs.existsSync(path.join(rulesOf(h), 'other.md')));
    rimraf(h);
  }

  // TC-7.10: only the rule present, no receipt (manifest fallback).
  {
    const h = seedHome();
    fs.writeFileSync(path.join(rulesOf(h), 'topic-closure.md'), SRC_BYTES);
    const un = runInstallIn(h, ['--local', '--yes', '--uninstall']);
    c.equal('TC-7.10: uninstall exit 0', un.status, 0);
    c.ok('TC-7.10: rule removed via manifest fallback',
      !fs.existsSync(path.join(rulesOf(h), 'topic-closure.md')));
    rimraf(h);
  }

  // TC-7.11: already absent.
  {
    const h = seedHome();
    const un = runInstallIn(h, ['--local', '--yes', '--uninstall']);
    c.equal('TC-7.11: uninstall of an absent rule exits 0', un.status, 0);
    rimraf(h);
  }

  // TC-7.13: static wording and derivation.
  {
    const inst = fs.readFileSync(INSTALL, 'utf8');
    const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf8');
    c.ok('TC-7.13: install.sh does not count rules with ls',
      inst.indexOf('ls -1 "$CLAUDE_DIR/rules/"') === -1);
    c.ok('TC-7.13: install.sh says no "5 process rules"', inst.indexOf('5 process rules') === -1);
    c.ok('TC-7.13: install.sh says no "(5 files"', inst.indexOf('(5 files') === -1);
    c.ok('TC-7.13: install.sh help says 6 process rules', inst.indexOf('6 process rules') !== -1);
    c.ok('TC-7.13: install.sh banner says 6 files', inst.indexOf('(6 files') !== -1);
    c.ok('TC-7.13: rule_count is derived from MANIFEST_OWNS',
      /rule_count=0[\s\S]{0,200}MANIFEST_OWNS[\s\S]{0,200}rules\/\*\.md\)/.test(inst));
    c.ok('TC-7.13: README says "all six process rules"', readme.indexOf('all six process rules') !== -1);
    c.ok('TC-7.13: README no longer says "all five process rules"',
      readme.indexOf('all five process rules') === -1);
  }
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
