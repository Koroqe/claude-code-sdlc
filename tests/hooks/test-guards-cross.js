#!/usr/bin/env node
'use strict';

/**
 * Cross-guard properties (PRD Section 8, FR-9 / FR-10 / FR-11).
 *
 * Each guard has its own test file. These are the properties that only make
 * sense across all six — chiefly: can the whole set be turned off, and does
 * every refusal tell the reader what to do about it.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('guards — cross-cutting');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-cross-');

const GUARD_IDS = [
  'pre:bash:git-guard',
  'pre:write:shrink-guard',
  'pre:edit:read-guard',
  'pre:edit:config-protection',
  'pre:agent:isolation-guard',
  'stop:changelog-guard',
];

/** A project that trips several guards at once. */
function tripwireProject() {
  const root = path.join(scratch, 'trip-' + Math.random().toString(36).slice(2, 7));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'PRD.md'),
    Array.from({ length: 400 }, (_, i) => 'line ' + i).join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  const opts = { cwd: root, stdio: 'ignore' };
  spawnSync('git', ['init', '-q'], opts);
  spawnSync('git', ['config', 'user.email', 't@e.com'], opts);
  spawnSync('git', ['config', 'user.name', 'T'], opts);
  spawnSync('git', ['add', '.'], opts);
  spawnSync('git', ['commit', '-m', 'init', '--no-verify'], opts);
  spawnSync('git', ['branch', '-M', 'main'], opts);
  return root;
}

const root = tripwireProject();

/** One block-triggering call per guard. */
function blockFixtures() {
  return [
    ['pre:bash:git-guard', { session_id: 'x', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat(core): x"' } }],
    ['pre:write:shrink-guard', { session_id: 'x', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'docs/PRD.md'), content: 'tiny\n' } }],
    ['pre:edit:read-guard', { session_id: 'x', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(root, 'src/a.ts') } }],
    ['pre:edit:config-protection', { session_id: 'x', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'tsconfig.json'), content: JSON.stringify({ compilerOptions: { strict: false } }) } }],
    ['pre:agent:isolation-guard', { session_id: 'x', agent_id: 'a1', agent_type: 'general-purpose', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'CHANGELOG.md'), content: 'x' } }],
  ];
}
function decisionOf(r) {
  const d = r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision;
  return d || (r.json && r.json.decision) || '';
}
function reasonOf(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason)
    || (r.json && r.json.reason) || '';
}

// --- every guard actually refuses when it should -------------------------
const reasons = [];
for (const [id, input] of blockFixtures()) {
  const r = runHook(id, input, { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
  c.equal(id + ' refuses', decisionOf(r), 'deny');
  reasons.push([id, reasonOf(r)]);
}

// --- every reason is actionable on its own -------------------------------
for (const [id, text] of reasons) {
  c.ok(id + ' reason carries a deviation token',
    /\[deviation: rule-\d+ — [^\]]+\]/.test(text), text.slice(0, 140));
  c.ok(id + ' reason needs no external document',
    text.indexOf('error-recovery.md') === -1 && text.indexOf('see docs/') === -1, text.slice(0, 140));
  c.ok(id + ' reason says what to do instead', text.length > 80, text);
}

// --- SDLC_DISABLED_HOOKS silences every guard ----------------------------
const all = GUARD_IDS.join(',');
for (const [id, input] of blockFixtures()) {
  const r = runHook(id, input, { SDLC_HOOK_HANDLERS_DIR: HANDLERS, SDLC_DISABLED_HOOKS: all });
  c.equal(id + ' is silent when disabled', decisionOf(r), '');
  c.ok(id + ' emits no message when disabled', !(r.json && r.json.systemMessage));
}

// --- the master kill switch ----------------------------------------------
for (const [id, input] of blockFixtures()) {
  const r = runHook(id, input, { SDLC_HOOK_HANDLERS_DIR: HANDLERS, SDLC_HOOKS_ENABLED: '0' });
  c.equal(id + ' is silent under the master kill switch', decisionOf(r), '');
}

// --- the minimal profile drops every guard -------------------------------
for (const [id, input] of blockFixtures()) {
  const r = runHook(id, input, { SDLC_HOOK_HANDLERS_DIR: HANDLERS, SDLC_HOOK_PROFILE: 'minimal' });
  c.equal(id + ' is dropped by the minimal profile', decisionOf(r), '');
}

// --- disabling one guard leaves the others working -----------------------
const one = runHook('pre:write:shrink-guard', blockFixtures()[1][1],
  { SDLC_HOOK_HANDLERS_DIR: HANDLERS, SDLC_DISABLED_HOOKS: 'pre:bash:git-guard' });
c.equal('disabling git-guard does not disable shrink-guard', decisionOf(one), 'deny');

// --- no guard grants itself an exception ---------------------------------
// A guard that could set its own escape variable would be able to switch
// itself off, which is the one thing a guard must never be able to do.
const guardSources = fs.readdirSync(HANDLERS).filter((f) => f.endsWith('.js'));
for (const file of guardSources) {
  const raw = fs.readFileSync(path.join(HANDLERS, file), 'utf8');
  // Strip comments: threat-model notes legitimately mention these filenames.
  const src = raw.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  // An assignment is `=` NOT followed by another `=`; `process.env.X === '1'`
  // is a read, which is exactly what a guard is supposed to do.
  c.ok(file + ' never assigns to process.env',
    !/process\.env\s*\[[^\]]*\]\s*=[^=]/.test(src) && !/process\.env\.[A-Za-z_]+\s*=[^=]/.test(src), file);
  c.ok(file + ' never deletes an env var', src.indexOf('delete process.env') === -1);
  c.ok(file + ' never writes hooks.json',
    !/writeFileSync\([^)]*hooks\.json/.test(src));
  c.ok(file + ' never writes settings.json',
    !/writeFileSync\([^)]*settings\.json/.test(src));
}

// --- guards never leak their own variables into a child process ---------
for (const file of ['pre-bash-git-guard.js', 'stop-changelog-guard.js']) {
  const src = fs.readFileSync(path.join(HANDLERS, file), 'utf8');
  const envBlock = /env:\s*\{[\s\S]*?\}/.exec(src);
  c.ok(file + ' builds a child env allowlist', !!envBlock, file);
  if (envBlock) {
    c.ok(file + ' does not forward SDLC_* to the child', envBlock[0].indexOf('SDLC_') === -1);
    c.ok(file + ' neutralises repo git config', src.indexOf('core.fsmonitor=') !== -1);
  }
}

// --- exit code 2 exists nowhere in the harness ---------------------------
function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
for (const file of walk(path.join(REPO_ROOT, 'hooks'), []).filter((f) => f.endsWith('.js'))) {
  const code = fs.readFileSync(file, 'utf8').split('\n')
    .filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n');
  c.ok(path.relative(REPO_ROOT, file) + ' never exits 2', code.indexOf('exit(2)') === -1);
}

// --- asset budget ---------------------------------------------------------
// Ten since pre:compact:probe joined. The roadmap's ceiling is 12 hooks;
// this assertion exists so growth toward it is a decision, not a drift.
c.equal('ten handlers ship', fs.readdirSync(HANDLERS).filter((f) => f.endsWith('.js')).length, 10);
c.ok('no package.json under hooks/', !fs.existsSync(path.join(REPO_ROOT, 'hooks', 'package.json')));
const hooksJson = fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8');
c.ok('the deferred gateguard is not registered', hooksJson.indexOf('gateguard') === -1);

// --- a malfunctioning guard ALLOWS, for every guard ----------------------
// This is the direction that matters: for a guard, fail-open means allow.
// Inverting it would refuse everything.
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'guards', 'handlers');
for (const [id, input] of blockFixtures()) {
  const r = runHook(id, input, { SDLC_HOOK_HANDLERS_DIR: FIXTURES, SDLC_TEST_MODE: 'throw' });
  c.equal(id + ' allows when it malfunctions', decisionOf(r), '');
  c.equal(id + ' still exits 0 when it malfunctions', r.code, 0);
}

rimraf(scratch);
c.finish();
