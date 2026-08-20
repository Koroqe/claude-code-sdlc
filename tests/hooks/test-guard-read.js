#!/usr/bin/env node
'use strict';

/** pre:edit:read-guard (PRD Section 8, FR-4) — one handler, two events. */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('pre:edit:read-guard');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-readguard-');

function project(name) {
  const root = path.join(scratch, name);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'src', 'b.ts'), 'export const b = 2;\n');
  return root;
}

function record(root, session, target, env, toolName) {
  return runHook('pre:edit:read-guard',
    { session_id: session, cwd: root, hook_event_name: 'PostToolUse', tool_name: toolName || 'Read', tool_input: { file_path: target } },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function gate(root, session, target, env) {
  return runHook('pre:edit:read-guard',
    { session_id: session, cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: target } },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function denied(r) {
  return !!(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision === 'deny');
}
function reason(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || '';
}

const root = project('p1');
const A = path.join(root, 'src', 'a.ts');
const B = path.join(root, 'src', 'b.ts');

// --- the core sequence ----------------------------------------------------
let r = gate(root, 's1', A);
c.ok('editing an unread file is refused', denied(r));
c.contains('reason names the file', reason(r), 'src/a.ts');
c.contains('reason explains compaction', reason(r), 'compaction');
c.contains('reason gives the remedy', reason(r), 'Read the file');
c.contains('reason carries a deviation token', reason(r), '[deviation: rule-1');

record(root, 's1', A);
r = gate(root, 's1', A);
c.ok('after a Read, the same edit is allowed', !denied(r), reason(r));

r = gate(root, 's1', B);
c.ok('a different unread file is still refused', denied(r));

// --- repeat edits do not consume the record ------------------------------
for (let i = 0; i < 3; i += 1) {
  const res = gate(root, 's1', A);
  c.ok('repeat edit ' + (i + 1) + ' still allowed', !denied(res));
}

// --- the record is session-scoped: this is the compaction case -----------
r = gate(root, 's2', A);
c.ok('a fresh session refuses despite the earlier read', denied(r));
record(root, 's2', A);
r = gate(root, 's2', A);
c.ok('and one Read resolves it', !denied(r), reason(r));

// --- path spellings must compare equal ----------------------------------
const rel = 'src/a.ts';
r = gate(root, 's1', rel);
c.ok('a relative path matches the recorded absolute one', !denied(r), reason(r));
r = gate(root, 's1', path.join(root, 'src', '..', 'src', 'a.ts'));
c.ok('a non-normalised path matches too', !denied(r), reason(r));

// --- creating a new file is never a violation ---------------------------
r = runHook('pre:edit:read-guard',
  { session_id: 's3', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Write',
    tool_input: { file_path: path.join(root, 'src', 'brand-new.ts'), content: 'x' } },
  { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
c.ok('creating a file that does not exist is allowed', !denied(r), reason(r));

// --- the recorder half cannot refuse, structurally ----------------------
r = record(root, 's4', A);
c.equal('the recorder exits 0', r.code, 0);
c.ok('the recorder emits no decision',
  !(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision));

// --- the record uses .reads, not .paths ---------------------------------
const tmpDir = path.join(root, '.claude', 'tmp');
const names = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
c.ok('a .reads record exists', names.some((n) => n.endsWith('.reads')), names.join(','));
c.ok('no .paths record was created by this guard',
  !names.some((n) => n.endsWith('.paths')), names.join(','));

// --- an unreadable record allows (mechanism failure, not a state fact) ---
const tracker = require(path.join(REPO_ROOT, 'hooks', 'lib', 'read-tracker.js'));
const recFile = tracker.recordPath(root, 's5');
fs.mkdirSync(path.dirname(recFile), { recursive: true });
fs.mkdirSync(recFile, { recursive: true });     // a directory where a file belongs
r = gate(root, 's5', A);
c.ok('an unreadable record allows rather than denies', !denied(r), reason(r));
fs.rmSync(recFile, { recursive: true, force: true });

// --- escape and kill switch ---------------------------------------------
r = gate(root, 's6', A, { SDLC_ALLOW_UNREAD_EDIT: '1' });
c.ok('the escape allows the edit', !denied(r));
c.contains('and announces the bypass', r.json && r.json.systemMessage, 'bypassed');

r = gate(root, 's7', A, { SDLC_DISABLED_HOOKS: 'pre:edit:read-guard' });
c.ok('the kill switch disables the gate', !denied(r));
c.ok('and is silent', !(r.json && r.json.systemMessage));

// The kill switch must disable both halves, since they share one id.
r = record(root, 's8', A, { SDLC_DISABLED_HOOKS: 'pre:edit:read-guard' });
c.equal('the recorder is disabled too', r.code, 0);
r = gate(root, 's8', A);
c.ok('so nothing was recorded while disabled', denied(r));

// --- TC-A1: a Write records freshness just like a Read (matcher widening) ---
record(root, 's-w1', A, null, 'Write');
r = gate(root, 's-w1', A);
c.ok('TC-A1: editing a file after a Write is allowed', !denied(r), reason(r));

// --- TC-A2: hooks.json actually routes Write to the read-guard recorder ---
// (config-level assertion, not a handler invocation — the harness invokes
// handlers by id, bypassing matcher routing, so TC-A1 above would pass even
// before the hooks.json fix ships. This is the genuinely red test.)
function matcherRoutesWrite(matcher) {
  return new RegExp(matcher).test('Write');
}
const hooksConfig = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8'));
const postToolUseEntries = (hooksConfig.hooks && hooksConfig.hooks.PostToolUse) || [];
const readGuardEntry = postToolUseEntries.find(
  (entry) => (entry.hooks || []).some((h) => h.id === 'pre:edit:read-guard'));
c.ok('TC-A2: hooks.json has a PostToolUse entry for pre:edit:read-guard', !!readGuardEntry);
c.ok('TC-A2: that entry\'s matcher routes Write to the recorder',
  !!readGuardEntry && matcherRoutesWrite(readGuardEntry.matcher),
  readGuardEntry && readGuardEntry.matcher);

// --- TC-A18: negative control — the same assertion correctly rejects a Read-only matcher ---
const readOnlyFixture = { matcher: 'Read', hooks: [{ id: 'pre:edit:read-guard' }] };
c.ok('TC-A18: the assertion logic correctly rejects a Read-only matcher',
  !matcherRoutesWrite(readOnlyFixture.matcher));

rimraf(scratch);
c.finish();
