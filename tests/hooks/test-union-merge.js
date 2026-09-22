#!/usr/bin/env node
'use strict';

/**
 * Union-merge semantics — hermetic two-branch merges through git's REAL union
 * driver, not a simulation (PRD §15 FR-2/FR-3; TC-CC.12 repo half, TC-3.1,
 * TC-CC.11, TC-2.4, TC-1.6).
 *
 * What is asserted, and why it is honest evidence:
 *
 *  - Section R pins this repo's .gitattributes: `merge=union` for the root
 *    CHANGELOG.md and .claude/instincts.md, and NOTHING else — the scratchpad
 *    and templates/CHANGELOG.md must stay unspecified (the root file is
 *    anchored `/CHANGELOG.md` precisely so the template copy is not covered).
 *
 *  - Section A runs the spec's primary scenario: two branches each add a
 *    changelog entry under today, add a same-slug instinct entry, and bump
 *    `Feature counter` N→N+1, then merge. Zealous union refinement folds
 *    lines that are identical on both sides, so the MEASURED union artifacts
 *    (probed on git 2.15) are: identical counter bumps collapse to ONE line —
 *    the undercount class (a)'s max-repair is documented to preserve; the
 *    identical `### <slug>` heading folds while the differing field lines are
 *    both kept — class (d)'s raw shape (duplicate field lines in one entry);
 *    and the changelog keeps ONE `## <today>` heading with both entries under
 *    it, on which stop:changelog-guard's head-scan must still pass, exercised
 *    end-to-end through the real hook on the dirty pre-commit merge state.
 *
 *  - Section B diverges the cadence (one branch consolidates twice, 4→6; the
 *    other once, 4→5, with a sloppy duplicate-section append) so the union
 *    driver genuinely produces the remaining raw classes: duplicate
 *    `Feature counter:` lines (a), duplicate `### <slug>` headings (b), a
 *    `Last confirmed at:` exceeding a present counter line (c), and a
 *    duplicated `## Instincts Log` section heading (e). Union PRESERVES both
 *    sides — it never deduplicates — which is exactly why merge-ready's
 *    Merge Reconciliation preamble exists.
 *
 *  - Section N is the negative control: the identical Section-A merge with no
 *    .gitattributes MUST fail with raw conflict markers in BOTH files — a
 *    check that only ever passes is not evidence (TC-2.4, Risk-2 degrade).
 *
 *  - Section D is the legacy arm: a still-TRACKED .claude/scratchpad.md is
 *    NOT union-covered, conflicts normally, and the FR-4 singleton rule
 *    (resolve `ours`) preserves the merging branch's content byte-for-byte
 *    (TC-1.6).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('union merge');

if (process.platform === 'win32') {
  process.stdout.write('SKIP union merge — win32 path semantics differ\n');
  process.exit(0);
}

const gitOk = spawnSync('git', ['--version'], { encoding: 'utf8' });
if (gitOk.status !== 0) {
  process.stdout.write('FAIL union merge — git is a declared dependency and is unavailable\n');
  process.exit(1);
}

// Sandboxed git env: no user/system config can alter merge behavior — the
// same discipline as test-gitignore-hygiene.js.
const sandboxHome = tempDir('sdlc-union-home-');
const emptyConfig = path.join(sandboxHome, 'empty-gitconfig');
fs.writeFileSync(emptyConfig, '');
const GIT_ENV = Object.assign({}, process.env, {
  HOME: sandboxHome,
  GIT_CONFIG_GLOBAL: emptyConfig,
  GIT_CONFIG_NOSYSTEM: '1',
});

function mkRepo(prefix) {
  const repo = tempDir(prefix);
  const git = (args) => spawnSync('git', args, { cwd: repo, env: GIT_ENV, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['config', 'user.name', 'union-merge-test']);
  return { repo, git };
}

function read(repo, rel) {
  return fs.readFileSync(path.join(repo, rel), 'utf8');
}

function lineCount(text, predicate) {
  return text.split('\n').filter(predicate).length;
}

/** Raw conflict-marker lines — the shapes the union driver must never emit. */
function markerCount(text) {
  return lineCount(text, (l) =>
    l.startsWith('<<<<<<<') || l === '=======' || l.startsWith('>>>>>>>'));
}

/** `git check-attr merge -- <path>` → the reported value ('union', 'unspecified', …). */
function mergeAttr(cwd, rel) {
  const r = spawnSync('git', ['check-attr', 'merge', '--', rel], {
    cwd, env: GIT_ENV, encoding: 'utf8',
  });
  const m = /: merge: (.+)\s*$/.exec(String(r.stdout || ''));
  return m ? m[1].trim() : null;
}

// --- Section R: this repo's .gitattributes (TC-CC.12, repo half) ----------

const repoAttrsPath = path.join(REPO_ROOT, '.gitattributes');
c.ok('R1: repo .gitattributes exists', fs.existsSync(repoAttrsPath));
const repoAttrs = fs.existsSync(repoAttrsPath) ? fs.readFileSync(repoAttrsPath, 'utf8') : '';

c.equal('R2: CHANGELOG.md merge attr is union in this repo',
  mergeAttr(REPO_ROOT, 'CHANGELOG.md'), 'union');
c.equal('R3: .claude/instincts.md merge attr is union in this repo',
  mergeAttr(REPO_ROOT, '.claude/instincts.md'), 'union');
c.equal('R4: .claude/scratchpad.md carries NO merge attr (nothing else)',
  mergeAttr(REPO_ROOT, '.claude/scratchpad.md'), 'unspecified');
// templates/CHANGELOG.md is covered by templates/.gitattributes (the installer
// scaffold, a different artifact), so the anchoring probe uses a path no
// attributes file governs: nested changelogs must NOT inherit the root rule.
c.equal('R5: a nested CHANGELOG.md is NOT covered (root pattern is anchored)',
  mergeAttr(REPO_ROOT, 'docs/CHANGELOG.md'), 'unspecified');

const attrDecls = repoAttrs.split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith('#'));
c.equal('R6: exactly two attribute declarations, nothing else', attrDecls.length, 2);
c.ok('R7: every declaration is merge=union',
  attrDecls.length > 0 && attrDecls.every((l) => /\smerge=union$/.test(l)),
  attrDecls.join('|') || '(no declarations)');

// --- Shared fixture content ------------------------------------------------

const TODAY = (() => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
})();

const BASE_CHANGELOG = [
  '# Changelog', '',
  'All notable changes to this project, newest first. Entries are grouped by UTC date.', '',
  '## 2026-09-20', '',
  '### Old entry — 09:00 UTC',
  '**Summary:** Something earlier.',
  '**Details:** Earlier work.', '',
].join('\n');

const BASE_INSTINCTS = [
  '# Instincts', '',
  '## Meta', '',
  'Feature counter: 4', '',
  '## Prevention Rules', '',
  '## Instincts Log', '',
  '### existing-entry',
  'Confidence: 0.3',
  'Category: general',
  'Pattern: src/old.js',
  'Rule: ALWAYS keep the old thing',
  'Trigger: Gate Auto-Fix',
  'Occurrences: 1 (features: older-feature)',
  'Last confirmed at: 3',
  'Retires at: 13', '',
].join('\n');

/** Base changelog with a new day-block for TODAY inserted after the header. */
function changelogWith(name, time) {
  const lines = BASE_CHANGELOG.split('\n');
  const block = ['## ' + TODAY, '',
    '### ' + name + ' — ' + time + ' UTC',
    '**Summary:** ' + name + ' summary a non-engineer can read.',
    '**Details:** ' + name + ' details, well under the cap.', ''];
  return lines.slice(0, 4).concat(block, lines.slice(4)).join('\n');
}

/** One instinct entry in the store's real field shape. Every field line is
 * side-specific on purpose: union refinement folds identical lines, so a
 * shared line would collapse and hide the duplication the test measures. */
function entry(slug, conf, feat, confirmedAt) {
  const alt = feat === 'feat-a';
  return ['### ' + slug,
    'Confidence: ' + conf,
    'Category: ' + (alt ? 'general' : 'data-integrity'),
    'Pattern: src/' + feat + '.js',
    'Rule: ALWAYS check the ' + feat + ' path first',
    'Trigger: ' + (alt ? 'User Correction' : 'Gate Auto-Fix'),
    'Occurrences: 1 (features: ' + feat + ')',
    'Last confirmed at: ' + confirmedAt,
    'Retires at: ' + (confirmedAt + 10), ''].join('\n');
}

/** Seed a repo with base files, commit, and author the two sides. `withAttrs`
 * is what separates Section A from its negative control. */
function buildTwoBranchRepo(prefix, withAttrs) {
  const { repo, git } = mkRepo(prefix);
  if (withAttrs) fs.writeFileSync(path.join(repo, '.gitattributes'), repoAttrs);
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), BASE_CHANGELOG);
  fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude/instincts.md'), BASE_INSTINCTS);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  git(['branch', 'side-b']);

  git(['checkout', '-q', '-b', 'side-a']);
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), changelogWith('Feature alpha', '10:00'));
  fs.writeFileSync(path.join(repo, '.claude/instincts.md'),
    BASE_INSTINCTS.replace('Feature counter: 4', 'Feature counter: 5') +
    entry('shared-slug', '0.4', 'feat-a', 5));
  git(['commit', '-q', '-am', 'feature alpha']);

  git(['checkout', '-q', 'side-b']);
  fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), changelogWith('Feature beta', '10:05'));
  fs.writeFileSync(path.join(repo, '.claude/instincts.md'),
    BASE_INSTINCTS.replace('Feature counter: 4', 'Feature counter: 5') +
    entry('shared-slug', '0.5', 'feat-b', 5));
  git(['commit', '-q', '-am', 'feature beta']);

  git(['checkout', '-q', 'side-a']);
  return { repo, git };
}

// --- Section A: primary two-branch union merge (TC-3.1, TC-CC.11) ---------

const A = buildTwoBranchRepo('sdlc-union-a-', true);
const aMerge = A.git(['merge', '--no-commit', '--no-ff', 'side-b']);
c.equal('A1: union merge resolves clean (exit 0)', aMerge.status, 0);

const aLog = read(A.repo, 'CHANGELOG.md');
const aStore = read(A.repo, '.claude/instincts.md');
c.equal('A2: zero conflict markers in CHANGELOG.md', markerCount(aLog), 0);
c.equal('A3: zero conflict markers in instincts.md', markerCount(aStore), 0);

// Changelog union shape: refinement folds the identical day heading; both
// entries survive beneath it, ours first. Nothing from either side is lost.
c.equal('A4: exactly one `## ' + TODAY + '` heading after union',
  lineCount(aLog, (l) => l.trim() === '## ' + TODAY), 1);
c.contains('A5: ours entry present', aLog, '### Feature alpha — 10:00 UTC');
c.contains('A5: theirs entry present', aLog, '### Feature beta — 10:05 UTC');
c.contains('A6: older day intact', aLog, '## 2026-09-20');
c.contains('A6: older entry intact', aLog, '### Old entry — 09:00 UTC');

// TC-CC.11 — the REAL hook on the real dirty merge state (CHANGELOG.md is
// staged-modified before the merge commit), never findDefect re-implemented.
const guard = runHook('stop:changelog-guard',
  { hook_event_name: 'Stop', cwd: A.repo, session_id: 'union-merge-test' },
  { HOME: sandboxHome, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1',
    SDLC_ALLOW_CHANGELOG_SHAPE: '' },
  { cwd: A.repo });
c.equal('A7: stop:changelog-guard exits 0 on the union output', guard.code, 0);
c.ok('A8: head-scan raises no defect on the union output',
  guard.stdout.indexOf('"reason"') === -1 && guard.stdout.indexOf('changelog-guard') === -1,
  guard.stdout.slice(0, 300));

// Class (a), merged-collapse form: both sides bumped 4→5 identically, so the
// union holds ONE counter line at N+1 — two features advanced it by one. That
// undercount is exactly what the preamble's max-repair note documents as safe.
c.equal('A9: identical bumps collapse to a single counter line',
  lineCount(aStore, (l) => l.startsWith('Feature counter:')), 1);
c.contains('A9: the surviving counter is N+1', aStore, 'Feature counter: 5');

// Class (d), raw form: the identical `### shared-slug` heading folds; every
// side-specific field line is kept from BOTH sides — duplicate field lines
// within one entry, which reconciliation step (d) repairs.
c.equal('A10: the same-slug heading folds to one occurrence',
  lineCount(aStore, (l) => l.trim() === '### shared-slug'), 1);
c.equal('A10: both sides\' Confidence lines survive under it (3 = 1 existing + 2 dup)',
  lineCount(aStore, (l) => l.startsWith('Confidence:')), 3);
c.contains('A11: ours feature list survives', aStore, '(features: feat-a)');
c.contains('A11: theirs feature list survives', aStore, '(features: feat-b)');
c.contains('A12: untouched existing entry intact', aStore, '### existing-entry');

const aCommit = A.git(['commit', '-q', '-m', 'sync side-a with side-b']);
c.equal('A13: the merge commit completes', aCommit.status, 0);

// --- Section B: divergent cadence → raw classes (a), (b), (c), (e) --------

const B = (() => {
  const { repo, git } = mkRepo('sdlc-union-b-');
  fs.writeFileSync(path.join(repo, '.gitattributes'), repoAttrs);
  fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude/instincts.md'), BASE_INSTINCTS);
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  git(['branch', 'side-d']);

  // side-c consolidated twice (counter 4→6) and inserted its capture at the
  // TOP of the log, confirmed at 6.
  git(['checkout', '-q', '-b', 'side-c']);
  const cLines = BASE_INSTINCTS.replace('Feature counter: 4', 'Feature counter: 6').split('\n');
  const logIdx = cLines.indexOf('## Instincts Log');
  fs.writeFileSync(path.join(repo, '.claude/instincts.md'),
    cLines.slice(0, logIdx + 2)
      .concat(entry('shared2', '0.6', 'feat-a', 6).split('\n'), cLines.slice(logIdx + 2))
      .join('\n'));
  git(['commit', '-q', '-am', 'two consolidations']);

  // side-d consolidated once (counter 4→5) and appended sloppily at EOF,
  // duplicating the section heading — the store shape parseStore silently
  // folds, which union then faithfully preserves into the merged file.
  git(['checkout', '-q', 'side-d']);
  fs.writeFileSync(path.join(repo, '.claude/instincts.md'),
    BASE_INSTINCTS.replace('Feature counter: 4', 'Feature counter: 5') +
    '\n## Instincts Log\n\n' + entry('shared2', '0.5', 'feat-b', 5));
  git(['commit', '-q', '-am', 'one consolidation, sloppy append']);

  git(['checkout', '-q', 'side-c']);
  return { repo, git };
})();

const bMerge = B.git(['merge', '--no-commit', '--no-ff', 'side-d']);
c.equal('B1: divergent-cadence union merge resolves clean', bMerge.status, 0);
const bStore = read(B.repo, '.claude/instincts.md');
c.equal('B2: zero conflict markers', markerCount(bStore), 0);

// Class (a) raw: divergent counter values conflict, union keeps BOTH lines.
const counters = bStore.split('\n').filter((l) => l.startsWith('Feature counter:'));
c.equal('B3: class (a) — two duplicate counter lines', counters.length, 2);
c.ok('B3: both cadences present, ours first',
  counters[0] === 'Feature counter: 6' && counters[1] === 'Feature counter: 5',
  counters.join('|'));

// Class (b) raw: the same slug captured at two positions — both blocks survive.
c.equal('B4: class (b) — duplicate `### shared2` headings',
  lineCount(bStore, (l) => l.trim() === '### shared2'), 2);

// Class (c) shape: a confirmation count exceeding a counter line present in
// the same store — the clamp's exact target until (a)'s max-repair runs.
c.contains('B5: class (c) — a Last confirmed at beyond the lower counter',
  bStore, 'Last confirmed at: 6');
c.ok('B5: the exceeded counter line is present',
  counters.indexOf('Feature counter: 5') !== -1, counters.join('|'));

// Class (e) raw: the duplicated section heading survives the union untouched.
c.equal('B6: class (e) — duplicate `## Instincts Log` headings',
  lineCount(bStore, (l) => l.trim() === '## Instincts Log'), 2);

c.contains('B7: ours capture survives', bStore, 'Pattern: src/feat-a.js');
c.contains('B7: theirs capture survives', bStore, 'Pattern: src/feat-b.js');

// --- Section N: negative control — no .gitattributes (TC-2.4) -------------

const N = buildTwoBranchRepo('sdlc-union-neg-', false);
const nMerge = N.git(['merge', '--no-commit', '--no-ff', 'side-b']);
c.ok('N1: without .gitattributes the identical merge FAILS', nMerge.status !== 0,
  'status=' + nMerge.status);
const nLog = read(N.repo, 'CHANGELOG.md');
const nStore = read(N.repo, '.claude/instincts.md');
c.ok('N2: raw conflict markers in CHANGELOG.md (machinery can fail)',
  markerCount(nLog) >= 3, 'markers=' + markerCount(nLog));
c.ok('N3: raw conflict markers in instincts.md (machinery can fail)',
  markerCount(nStore) >= 3, 'markers=' + markerCount(nStore));

// --- Section D: legacy tracked scratchpad resolves `ours` (TC-1.6) --------

const D = (() => {
  const { repo, git } = mkRepo('sdlc-union-scratch-');
  fs.writeFileSync(path.join(repo, '.gitattributes'), repoAttrs);
  fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.claude/scratchpad.md'),
    '## Feature: none active\n## Status: idle\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  git(['branch', 'side-h']);

  git(['checkout', '-q', '-b', 'side-g']);
  fs.writeFileSync(path.join(repo, '.claude/scratchpad.md'),
    '## Feature: feature-g\n## Status: implementing slice 2/5\n## Plan\n- [x] Slice 1 — abc123\n');
  git(['commit', '-q', '-am', 'g state']);

  git(['checkout', '-q', 'side-h']);
  fs.writeFileSync(path.join(repo, '.claude/scratchpad.md'),
    '## Feature: feature-h\n## Status: quality-gates\n## Plan\n- [x] Slice 1 — def456\n');
  git(['commit', '-q', '-am', 'h state']);

  git(['checkout', '-q', 'side-g']);
  return { repo, git };
})();

const oursBytes = fs.readFileSync(path.join(D.repo, '.claude/scratchpad.md'));
const dMerge = D.git(['merge', '--no-commit', '--no-ff', 'side-h']);
c.ok('D1: a tracked scratchpad is NOT union-covered — the merge conflicts',
  dMerge.status !== 0, 'status=' + dMerge.status);
const dStatus = D.git(['status', '--porcelain', '--', '.claude/scratchpad.md']).stdout;
c.ok('D2: scratchpad is in the unmerged (UU) state', /^UU /.test(dStatus), dStatus);

// FR-4 singleton rule for legacy consumers: resolve `ours`.
D.git(['checkout', '--ours', '--', '.claude/scratchpad.md']);
D.git(['add', '.claude/scratchpad.md']);
const dCommit = D.git(['commit', '-q', '-m', 'sync side-g with side-h']);
c.equal('D3: the ours-resolved merge commits', dCommit.status, 0);
c.ok('D4: the merging branch\'s scratchpad survives byte-for-byte',
  fs.readFileSync(path.join(D.repo, '.claude/scratchpad.md')).equals(oursBytes),
  read(D.repo, '.claude/scratchpad.md').slice(0, 120));

// --- Cleanup ---------------------------------------------------------------

rimraf(A.repo);
rimraf(B.repo);
rimraf(N.repo);
rimraf(D.repo);
rimraf(sandboxHome);
c.finish();
