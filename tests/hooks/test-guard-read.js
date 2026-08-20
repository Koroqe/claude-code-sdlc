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

// TC-A17: identically for the Write spelling of the recorder.
r = record(root, 's8w', A, { SDLC_DISABLED_HOOKS: 'pre:edit:read-guard' }, 'Write');
c.equal('TC-A17: the Write recorder is disabled too', r.code, 0);
r = gate(root, 's8w', A);
c.ok('TC-A17: so a disabled Write minted nothing', denied(r));

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

// =========================================================================
// Slice 2 — FR-3.6 recorder residuals: errored Writes, permissive tool_name
// =========================================================================

/** Raw PostToolUse payload, for shapes record()'s fixed signature cannot express. */
function recordRaw(rt, session, payload, env) {
  return runHook('pre:edit:read-guard',
    Object.assign({ session_id: session, cwd: rt, hook_event_name: 'PostToolUse' }, payload),
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}

// --- TC-A4: consecutive Writes then an Edit ------------------------------
record(root, 's-a4', A, null, 'Write');
record(root, 's-a4', A, null, 'Write');
r = gate(root, 's-a4', A);
c.ok('TC-A4: Write, Write, Edit is allowed', !denied(r), reason(r));

// --- TC-A5: mixed Read and Write evidence in one session -----------------
record(root, 's-a5', A, null, 'Read');
record(root, 's-a5', B, null, 'Write');
r = gate(root, 's-a5', A);
c.ok('TC-A5: the Read-recorded file is editable', !denied(r), reason(r));
r = gate(root, 's-a5', B);
c.ok('TC-A5: the Write-recorded file is editable too', !denied(r), reason(r));

// --- TC-A8: no record at all denies --------------------------------------
// Structural proof that a *refused* Write cannot mint freshness: a refused
// call fires no PostToolUse at all, so its state is exactly "no record".
r = gate(root, 's-a8', A);
c.ok('TC-A8: with no record whatsoever the edit is refused', denied(r));

// --- TC-A9: a detectably-errored Write does not mint freshness -----------
recordRaw(root, 's-a9', {
  tool_name: 'Write', tool_input: { file_path: A }, tool_response: { is_error: true } });
r = gate(root, 's-a9', A);
c.ok('TC-A9: errored Write (is_error === true) leaves the Edit denied', denied(r));
c.contains('TC-A9: the deny reason is the unchanged one', reason(r), 'compaction');
c.contains('TC-A9: the deviation token is unchanged', reason(r), '[deviation: rule-1');

recordRaw(root, 's-a9b', {
  tool_name: 'Write', tool_input: { file_path: A }, tool_response: { error: 'disk full' } });
r = gate(root, 's-a9b', A);
c.ok('TC-A9: errored Write (truthy own error) leaves the Edit denied', denied(r));

// --- M14 strictness: only definite errors count --------------------------
recordRaw(root, 's-a9c', {
  tool_name: 'Write', tool_input: { file_path: A }, tool_response: { is_error: 'true' } });
r = gate(root, 's-a9c', A);
c.ok('M14: is_error must be strictly true — a string still records', !denied(r), reason(r));

recordRaw(root, 's-a9d', {
  tool_name: 'Write', tool_input: { file_path: A }, tool_response: { is_error: false, error: '' } });
r = gate(root, 's-a9d', A);
c.ok('M14: falsy indicators still record', !denied(r), reason(r));

// --- TC-A10: unclassifiable tool_response fails open ---------------------
recordRaw(root, 's-a10', {
  tool_name: 'Write', tool_input: { file_path: A }, tool_response: 'opaque string' });
r = gate(root, 's-a10', A);
c.ok('TC-A10: non-object tool_response records and allows', !denied(r), reason(r));

recordRaw(root, 's-a10b', {
  tool_name: 'Write', tool_input: { file_path: A }, tool_response: { ok: true } });
r = gate(root, 's-a10b', A);
c.ok('TC-A10: no recognizable indicator records and allows', !denied(r), reason(r));

recordRaw(root, 's-a10c', { tool_name: 'Write', tool_input: { file_path: A } });
r = gate(root, 's-a10c', A);
c.ok('TC-A10: absent tool_response records and allows', !denied(r), reason(r));

// --- M15: an errored *Read* keeps minting freshness (unchanged path) -----
recordRaw(root, 's-m15', {
  tool_name: 'Read', tool_input: { file_path: A }, tool_response: { is_error: true } });
r = gate(root, 's-m15', A);
c.ok('M15: errored Read — Edit still allowed, Read path byte-identical', !denied(r), reason(r));

// --- TC-A11: tool_name omitted or non-string still records ---------------
recordRaw(root, 's-a11', { tool_input: { file_path: A } });
r = gate(root, 's-a11', A);
c.ok('TC-A11: omitted tool_name defaults to recording', !denied(r), reason(r));

recordRaw(root, 's-a11b', { tool_name: 42, tool_input: { file_path: A } });
r = gate(root, 's-a11b', A);
c.ok('TC-A11: non-string tool_name defaults to recording', !denied(r), reason(r));

// --- TC-A12: record and gate as two separate processes -------------------
// Every runHook call spawns its own child process (see harness.js); this
// case makes the cross-process handoff explicit rather than incidental.
const recA12 = record(root, 's-a12', A, null, 'Write');
c.equal('TC-A12: the recording process exits 0', recA12.code, 0);
r = gate(root, 's-a12', A);
c.ok('TC-A12: a later, separate gate process sees the record', !denied(r), reason(r));

// --- TC-A13: unknown allows where no denies, under Write evidence --------
const recFileA13 = tracker.recordPath(root, 's-a13');
fs.mkdirSync(recFileA13, { recursive: true });   // a directory where a file belongs
r = gate(root, 's-a13', A);
c.ok('TC-A13: an unreadable record allows (mechanism failure)', !denied(r), reason(r));
fs.rmSync(recFileA13, { recursive: true, force: true });
record(root, 's-a13b', B, null, 'Write');
r = gate(root, 's-a13b', A);
c.ok('TC-A13: a readable record lacking the file denies', denied(r));

// --- TC-A14: notebook_path is evidence too -------------------------------
const NB = path.join(root, 'src', 'n.ipynb');
fs.writeFileSync(NB, '{}\n');
recordRaw(root, 's-a14', { tool_name: 'Write', tool_input: { notebook_path: NB } });
r = runHook('pre:edit:read-guard',
  { session_id: 's-a14', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'NotebookEdit',
    tool_input: { notebook_path: NB } },
  { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
c.ok('TC-A14: a Write recorded via notebook_path gates clean', !denied(r), reason(r));

// --- TC-A15/TC-A16: forbidden couplings, by source inspection ------------
const handlerSrc = fs.readFileSync(path.join(HANDLERS, 'pre-edit-read-guard.js'), 'utf8');
c.equal('TC-A15: exactly one freshness-recording call site',
  handlerSrc.split('recordRead').length - 1, 1);
c.ok('TC-A15: recording sits before the PreToolUse branch begins',
  handlerSrc.indexOf('recordRead') !== -1 &&
  handlerSrc.indexOf('recordRead') < handlerSrc.indexOf("event !== 'PreToolUse'"));
c.ok('TC-A16: no coupling to the accumulate handler',
  handlerSrc.indexOf('post-edit-accumulate') === -1);

rimraf(scratch);
c.finish();
