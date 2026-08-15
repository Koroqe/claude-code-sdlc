#!/usr/bin/env node
'use strict';

/**
 * Autonomy regression (PRD Section 8, FR-11).
 *
 * The guards are worthless if they stall an unattended run. This replays a
 * realistic slice's worth of tool calls through all six, and asserts two
 * things:
 *
 *   1. The calls a well-behaved pipeline actually makes are never refused.
 *   2. Every refusal that DOES happen is self-resolvable — following the
 *      remedy named in the reason produces an allow, with no human involved.
 *
 * What this proves and what it does not: it exercises the guards against the
 * real tool-call shapes a slice produces, which is where a false positive
 * would stall a run. It is not a live `/develop-feature` invocation, so it
 * cannot prove the model reads and acts on a remedy correctly — only that the
 * remedy exists and works when followed. The live run is the merge-ready
 * check; this is the one that can run in CI on every commit.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('autonomy regression');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-autonomy-');

/** A project shaped like one the pipeline actually works in. */
function seedProject() {
  const root = path.join(scratch, 'feature-work');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'qa'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'use-cases'), { recursive: true });
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'service.ts'), 'export const svc = 1;\n');
  fs.writeFileSync(path.join(root, 'docs', 'PRD.md'),
    Array.from({ length: 300 }, (_, i) => 'prd line ' + i).join('\n') + '\n');
  fs.writeFileSync(path.join(root, '.claude', 'scratchpad.md'),
    Array.from({ length: 60 }, (_, i) => 'note ' + i).join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '# Changelog\n\nAll notable changes.\n');
  const opts = { cwd: root, stdio: 'ignore' };
  spawnSync('git', ['init', '-q'], opts);
  spawnSync('git', ['config', 'user.email', 't@e.com'], opts);
  spawnSync('git', ['config', 'user.name', 'T'], opts);
  spawnSync('git', ['add', '.'], opts);
  spawnSync('git', ['commit', '-m', 'baseline', '--no-verify'], opts);
  spawnSync('git', ['checkout', '-q', '-b', 'feat/thing'], opts);
  return root;
}

const root = seedProject();
const SESSION = 'autonomy-1';

function hook(id, input, env) {
  return runHook(id, Object.assign({ session_id: SESSION, cwd: root }, input),
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function decisionOf(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision)
    || (r.json && r.json.decision) || '';
}
function reasonOf(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason)
    || (r.json && r.json.reason) || '';
}

/** Every guard sees every call, the way they do in a real session. */
function everyGuard(input, env) {
  const ids = input.hook_event_name === 'Stop'
    ? ['stop:changelog-guard']
    : ['pre:bash:git-guard', 'pre:write:shrink-guard', 'pre:edit:read-guard',
       'pre:edit:config-protection', 'pre:agent:isolation-guard'];
  const refusals = [];
  for (const id of ids) {
    const r = hook(id, input, env);
    if (r.code !== 0) refusals.push([id, 'NON-ZERO EXIT ' + r.code]);
    else if (decisionOf(r)) refusals.push([id, reasonOf(r)]);
  }
  return refusals;
}

// =========================================================================
// The sequence a well-behaved slice actually performs.
// =========================================================================
const steps = [
  // The pipeline reads the scratchpad at session start and the PRD before
  // rewriting it — both are real steps, not concessions to the guard.
  ['read the scratchpad at session start', { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: path.join(root, '.claude/scratchpad.md') } }],
  ['read the PRD before rewriting it', { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: path.join(root, 'docs/PRD.md') } }],
  ['read the file before editing it', { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: path.join(root, 'src/service.ts') } }],
  ['edit the file it just read', { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: path.join(root, 'src/service.ts'), old_string: 'svc = 1', new_string: 'svc = 2' } }],
  ['create a brand-new source file', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'src/new-thing.ts'), content: 'export const n = 1;\n' } }],
  ['create a QA document', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'docs/qa/thing_test_cases.md'), content: '# Test cases\n'.repeat(60) } }],
  ['grow the PRD', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'docs/PRD.md'), content: Array.from({ length: 340 }, (_, i) => 'prd line ' + i).join('\n') + '\n' } }],
  ['run the tests', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } }],
  ['check status', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status --short' } }],
  ['stage named files', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git add src/service.ts src/new-thing.ts' } }],
  ['commit conventionally on a feature branch', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat(core): add the thing"' } }],
  ['orchestrator updates the scratchpad', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, '.claude/scratchpad.md'), content: Array.from({ length: 70 }, (_, i) => 'note ' + i).join('\n') + '\n' } }],
];

let hardFailures = 0;
for (const [label, input] of steps) {
  const refusals = everyGuard(input);
  c.equal('allowed: ' + label, refusals.length, 0,
    refusals.map(([id, why]) => id + ': ' + String(why).slice(0, 120)).join(' | '));
  if (refusals.length) hardFailures += 1;
}

// The changelog step, written correctly, must also pass.
function todayUtc() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}
fs.writeFileSync(path.join(root, 'CHANGELOG.md'),
  '# Changelog\n\n## ' + todayUtc() + '\n\n### Add the thing — 12:00 UTC\n' +
  '**Summary:** Plain-language description.\n**Details:** A fuller note under the cap.\n');
let refusals = everyGuard({ hook_event_name: 'Stop' });
c.equal('allowed: end the response with a well-formed changelog entry', refusals.length, 0,
  refusals.map(([id, why]) => id + ': ' + String(why).slice(0, 160)).join(' | '));
if (refusals.length) hardFailures += 1;

c.equal('the whole slice ran without a single false refusal', hardFailures, 0);

// =========================================================================
// Every genuine refusal must be self-resolvable — no human required.
// =========================================================================

// 1. Editing an unread file → the remedy is one Read.
const untouched = path.join(root, 'src', 'never-read.ts');
fs.writeFileSync(untouched, 'export const u = 1;\n');
let r = hook('pre:edit:read-guard', { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: untouched } });
c.equal('an unread edit is refused', decisionOf(r), 'deny');
c.contains('and the remedy is named', reasonOf(r), 'Read the file');
hook('pre:edit:read-guard', { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: untouched } });
r = hook('pre:edit:read-guard', { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: untouched } });
c.equal('following the remedy resolves it', decisionOf(r), '');

// 2. A bad commit message → the remedy is to rewrite it.
r = hook('pre:bash:git-guard', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "did some stuff"' } });
c.equal('a non-conventional message is refused', decisionOf(r), 'deny');
r = hook('pre:bash:git-guard', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "fix(core): correct the thing"' } });
c.equal('rewriting the message resolves it', decisionOf(r), '');

// 3. A shrinking write → the remedy is the escape, self-applied.
r = hook('pre:write:shrink-guard', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'docs/PRD.md'), content: 'tiny\n' } });
c.equal('a gutting write is refused', decisionOf(r), 'deny');
c.contains('and names its escape', reasonOf(r), 'SDLC_ALLOW_SHRINK');
r = hook('pre:write:shrink-guard', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'docs/PRD.md'), content: 'tiny\n' } }, { SDLC_ALLOW_SHRINK: '1' });
c.equal('applying the escape resolves it', decisionOf(r), '');

// 4. A config weakening → escape, self-applied.
fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }, null, 2));
const weaken = { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(root, 'tsconfig.json'), content: JSON.stringify({ compilerOptions: { strict: false } }, null, 2) } };
r = hook('pre:edit:config-protection', weaken);
c.equal('a config weakening is refused', decisionOf(r), 'deny');
r = hook('pre:edit:config-protection', weaken, { SDLC_ALLOW_CONFIG_EDIT: '1' });
c.equal('applying the escape resolves it', decisionOf(r), '');

// 5. A malformed changelog → bounded, so it cannot loop forever.
fs.writeFileSync(path.join(root, 'CHANGELOG.md'),
  '# Changelog\n\n## ' + todayUtc() + '\n\n### Broken — 12:00 UTC\n**Summary:** s\n');
const blocks = [];
for (let i = 0; i < 4; i += 1) {
  blocks.push(decisionOf(hook('stop:changelog-guard', { hook_event_name: 'Stop' })) === 'block');
}
c.equal('the changelog guard blocks at most twice in a row',
  blocks.filter(Boolean).length, 2, JSON.stringify(blocks));
c.ok('and then lets the response end', blocks[2] === false && blocks[3] === false);

// =========================================================================
// A guard must never be able to wedge a run: every id can be turned off.
// =========================================================================
const ALL = 'pre:bash:git-guard,pre:write:shrink-guard,pre:edit:read-guard,' +
  'pre:edit:config-protection,pre:agent:isolation-guard,stop:changelog-guard';
let stillRefusing = 0;
for (const [, input] of steps) {
  if (everyGuard(input, { SDLC_DISABLED_HOOKS: ALL }).length) stillRefusing += 1;
}
c.equal('with every guard disabled, nothing is refused', stillRefusing, 0);

rimraf(scratch);
c.finish();
