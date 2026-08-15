#!/usr/bin/env node
'use strict';

/**
 * pre:agent:isolation-guard (PRD Section 8, FR-6).
 *
 * The stdin fixtures here were captured from a real orchestrator write and a
 * real subagent write during the FR-6.1 spike, so these tests exercise the
 * actual payload shape rather than an assumed one.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('pre:agent:isolation-guard');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const STDIN = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'guards', 'stdin');
const scratch = tempDir('sdlc-isolation-');

const subagentPayload = JSON.parse(fs.readFileSync(path.join(STDIN, 'pre-tool-use-subagent-write.json'), 'utf8'));
const orchestratorPayload = JSON.parse(fs.readFileSync(path.join(STDIN, 'pre-tool-use-orchestrator-write.json'), 'utf8'));

function call(payload, target, env) {
  const input = JSON.parse(JSON.stringify(payload));
  input.cwd = scratch;
  input.tool_input = { file_path: path.join(scratch, target), content: 'x' };
  return runHook('pre:agent:isolation-guard', input,
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
}
function denied(r) {
  return !!(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision === 'deny');
}
function reason(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || '';
}

// --- the captured fixtures really do differ ------------------------------
c.ok('the subagent fixture carries an origin field', typeof subagentPayload.agent_id === 'string');
c.ok('the orchestrator fixture does not', typeof orchestratorPayload.agent_id === 'undefined');
c.equal('both fixtures share a session id', subagentPayload.session_id, orchestratorPayload.session_id);

// --- a subagent is refused on both protected files -----------------------
for (const target of ['.claude/scratchpad.md', 'CHANGELOG.md']) {
  const r = call(subagentPayload, target);
  c.ok('subagent write to ' + target + ' is refused', denied(r));
  c.contains('reason names the file', reason(r), target);
  c.contains('reason names the remedy', reason(r), 'Return your findings');
  c.contains('reason carries a rule-3 token', reason(r), '[deviation: rule-3');
}

// --- the orchestrator is allowed on both ---------------------------------
for (const target of ['.claude/scratchpad.md', 'CHANGELOG.md']) {
  const r = call(orchestratorPayload, target);
  c.ok('orchestrator write to ' + target + ' is allowed', !denied(r), reason(r));
  c.ok('and is silent', !(r.json && r.json.systemMessage), JSON.stringify(r.json));
}

// --- unprotected files are never this guard's business -------------------
for (const target of ['docs/PRD.md', 'src/a.ts', 'README.md']) {
  const r = call(subagentPayload, target);
  c.ok('subagent write to ' + target + ' is allowed', !denied(r), reason(r));
}

// --- path spellings all resolve to the same protected file ---------------
for (const spelling of ['./CHANGELOG.md', 'docs/../CHANGELOG.md']) {
  const r = call(subagentPayload, spelling);
  c.ok('spelling is normalised: ' + spelling, denied(r));
}

// --- an empty indicator warns rather than passing in silence -------------
// This is the drift case: if the field ever arrives empty, the guard must not
// quietly behave as though the orchestrator wrote the file.
const emptyIndicator = JSON.parse(JSON.stringify(subagentPayload));
emptyIndicator.agent_id = '';
let r = call(emptyIndicator, '.claude/scratchpad.md');
c.ok('an empty indicator does not deny', !denied(r));
c.contains('but it says so out loud', r.json && r.json.systemMessage, 'could not determine');
c.contains('and names the backstops', r.json && r.json.systemMessage, 'Gate 0');
// It must not claim protection it is not providing.
const warned = (r.json && r.json.systemMessage) || '';
for (const word of ['blocked', 'denied', 'prevented']) {
  c.ok('the warning avoids the word "' + word + '"', warned.toLowerCase().indexOf(word) === -1, warned);
}

// --- escape and kill switch ----------------------------------------------
r = call(subagentPayload, 'CHANGELOG.md', { SDLC_ALLOW_SUBAGENT_WRITE: '1' });
c.ok('the escape allows the write', !denied(r));
c.contains('and announces the bypass', r.json && r.json.systemMessage, 'bypassed');

r = call(subagentPayload, 'CHANGELOG.md', { SDLC_DISABLED_HOOKS: 'pre:agent:isolation-guard' });
c.ok('the kill switch disables the guard', !denied(r));
c.ok('and is silent', !(r.json && r.json.systemMessage));

// --- the handler records its spike finding -------------------------------
const src = fs.readFileSync(path.join(HANDLERS, 'pre-agent-isolation-guard.js'), 'utf8');
c.contains('the handler records the spike finding', src, 'Spike finding:');
c.contains('the handler states the Edit/Write limit', src, 'only sees Edit and Write');

rimraf(scratch);
c.finish();
