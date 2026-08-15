#!/usr/bin/env node
'use strict';

/** stop:changelog-guard (PRD Section 8, FR-7). */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('stop:changelog-guard');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-clog-');

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

/** A git repo whose CHANGELOG.md is modified relative to HEAD. */
function repoWith(name, changelog) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(dir, { recursive: true });
  const opts = { cwd: dir, stdio: 'ignore' };
  spawnSync('git', ['init', '-q'], opts);
  spawnSync('git', ['config', 'user.email', 't@e.com'], opts);
  spawnSync('git', ['config', 'user.name', 'T'], opts);
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), '# Changelog\n\ncommitted baseline\n');
  spawnSync('git', ['add', 'CHANGELOG.md'], opts);
  spawnSync('git', ['commit', '-m', 'init', '--no-verify'], opts);
  if (changelog !== null) fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), changelog);
  return dir;
}

function stop(root, env) {
  return runHook('stop:changelog-guard',
    { session_id: 'c1', cwd: root, hook_event_name: 'Stop' },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function blocked(r) { return !!(r.json && r.json.decision === 'block'); }
function reason(r) { return (r.json && r.json.reason) || ''; }
function msg(r) { return (r.json && r.json.systemMessage) || ''; }

const GOOD =
  '# Changelog\n\n## ' + today() + '\n\n' +
  '### Add a thing — 09:15 UTC\n' +
  '**Summary:** Something a non-engineer can read.\n' +
  '**Details:** A fuller description that stays under the cap.\n';

// --- a well-formed entry passes -------------------------------------------
let r = stop(repoWith('good', GOOD));
c.equal('a well-formed entry exits 0', r.code, 0);
c.ok('a well-formed entry is not blocked', !blocked(r), reason(r));

// --- an unchanged changelog is not this guard's business ------------------
r = stop(repoWith('unchanged', null));
c.ok('an unchanged changelog produces nothing', !blocked(r) && !msg(r), JSON.stringify(r.json));

// --- shape defects --------------------------------------------------------
const defects = [
  ['no-summary', '# Changelog\n\n## ' + today() + '\n\n### X — 09:15 UTC\n**Details:** d\n', 'Summary'],
  ['no-details', '# Changelog\n\n## ' + today() + '\n\n### X — 09:15 UTC\n**Summary:** s\n', 'Details'],
  ['bad-heading', '# Changelog\n\n## ' + today() + '\n\n### X at 9am\n**Summary:** s\n**Details:** d\n', 'form'],
  ['no-day', '# Changelog\n\n## 2001-01-01\n\n### X — 09:15 UTC\n**Summary:** s\n**Details:** d\n', 'heading'],
  ['too-long', '# Changelog\n\n## ' + today() + '\n\n### X — 09:15 UTC\n**Summary:** s\n**Details:** ' + 'x'.repeat(600) + '\n', '600'],
  ['duplicate', '# Changelog\n\n## ' + today() + '\n\n### Dup — 09:15 UTC\n**Summary:** s\n**Details:** d\n\n### Dup — 08:00 UTC\n**Summary:** s\n**Details:** d\n', 'share the name'],
];
for (const [name, body, expect] of defects) {
  const res = stop(repoWith(name, body));
  c.ok(name + ' is blocked', blocked(res), reason(res));
  c.contains(name + ' reason names the defect', reason(res), expect);
  c.contains(name + ' reason carries a deviation token', reason(res), '[deviation: rule-1');
}

// --- freshness is deliberately NOT checked -------------------------------
// An entry written 40 minutes into a session is legitimate; refusing it would
// block correct work.
const stale = '# Changelog\n\n## ' + today() + '\n\n### Old timestamp — 00:01 UTC\n' +
  '**Summary:** s\n**Details:** d\n';
r = stop(repoWith('stale-time', stale));
c.ok('an old timestamp is not a defect', !blocked(r), reason(r));

// --- blocking is bounded --------------------------------------------------
const loop = repoWith('loop', '# Changelog\n\n## ' + today() + '\n\n### X — 09:15 UTC\n**Summary:** s\n');
r = stop(loop);
c.ok('first defective Stop blocks', blocked(r));
r = stop(loop);
c.ok('second defective Stop blocks', blocked(r));
r = stop(loop);
c.ok('third does NOT block', !blocked(r), reason(r));
c.contains('third explains why it gave up', msg(r), 'Already asked twice');

// A pass resets the count.
fs.writeFileSync(path.join(loop, 'CHANGELOG.md'), GOOD);
r = stop(loop);
c.ok('a good entry passes', !blocked(r));
fs.writeFileSync(path.join(loop, 'CHANGELOG.md'), '# Changelog\n\n## ' + today() + '\n\n### Y — 09:15 UTC\n**Summary:** s\n');
r = stop(loop);
c.ok('and the counter reset, so it blocks again', blocked(r));

// --- a symlinked changelog is refused, not followed ----------------------
const victim = path.join(scratch, 'secret.md');
fs.writeFileSync(victim, 'SECRET\n');
const linked = repoWith('linked', null);
fs.unlinkSync(path.join(linked, 'CHANGELOG.md'));
fs.symlinkSync(victim, path.join(linked, 'CHANGELOG.md'));
r = stop(linked);
c.equal('a symlinked changelog exits 0', r.code, 0);
c.ok('and leaks nothing', reason(r).indexOf('SECRET') === -1 && msg(r).indexOf('SECRET') === -1);

// --- a huge changelog is bounded, not fatal ------------------------------
const huge = repoWith('huge', '# Changelog\n\n## ' + today() + '\n\n### X — 09:15 UTC\n' +
  '**Summary:** s\n**Details:** d\n' + 'padding\n'.repeat(400000));
const started = Date.now();
r = stop(huge);
c.equal('a multi-megabyte changelog exits 0', r.code, 0);
c.ok('and completes promptly', Date.now() - started < 15000, String(Date.now() - started) + 'ms');

// --- not a git repo: silent -----------------------------------------------
const bare = path.join(scratch, 'not-a-repo');
fs.mkdirSync(bare, { recursive: true });
fs.writeFileSync(path.join(bare, 'CHANGELOG.md'), GOOD);
r = stop(bare);
c.ok('a non-repo produces nothing', !blocked(r) && !msg(r), JSON.stringify(r.json));

// --- escape and kill switch ----------------------------------------------
const bad = repoWith('escape', '# Changelog\n\n## ' + today() + '\n\n### X — 09:15 UTC\n**Summary:** s\n');
r = stop(bad, { SDLC_ALLOW_CHANGELOG_SHAPE: '1' });
c.ok('the escape prevents the block', !blocked(r));
c.contains('and announces the bypass', msg(r), 'bypassed');
r = stop(bad, { SDLC_DISABLED_HOOKS: 'stop:changelog-guard' });
c.ok('the kill switch disables the guard', !blocked(r));
c.ok('and is silent', !msg(r));

// --- it uses git, never the accumulator ----------------------------------
const src = fs.readFileSync(path.join(HANDLERS, 'stop-changelog-guard.js'), 'utf8');
c.ok('change detection does not read the edited-paths accumulator',
  src.indexOf('readPaths') === -1, 'must use git status, not the accumulator');
c.contains('git spawn neutralises repo config', src, 'core.fsmonitor=');

rimraf(scratch);
c.finish();
