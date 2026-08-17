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

// --- TC-16.1: a subagent write to .claude/instincts.md is refused --------
// FR-7.2 — PROTECTED gains .claude/instincts.md as its third entry. Reuses
// the captured subagent-origin fixture, overriding only tool_input.file_path
// so the empirically-captured agent_id/agent_type shape survives unchanged.
r = call(subagentPayload, '.claude/instincts.md');
c.ok('TC-16.1: subagent write to .claude/instincts.md is refused', denied(r));
c.contains('TC-16.1: reason names the path', reason(r), '.claude/instincts.md');
c.contains('TC-16.1: reason names the agent type', reason(r), subagentPayload.agent_type);
c.contains('TC-16.1: reason carries the rule-3 token', reason(r), '[deviation: rule-3');

// --- TC-16.2: the identical write from the orchestrator is allowed, and is
// silent (UC-16-A1) ---------------------------------------------------------
r = call(orchestratorPayload, '.claude/instincts.md');
c.ok('TC-16.2: orchestrator write to .claude/instincts.md is allowed', !denied(r), reason(r));
c.ok('TC-16.2: and is silent', !(r.json && r.json.systemMessage), JSON.stringify(r.json));

// --- TC-16.3: SDLC_ALLOW_SUBAGENT_WRITE=1 permits the write, with a bypass
// notice naming the path (UC-16-A2) -----------------------------------------
r = call(subagentPayload, '.claude/instincts.md', { SDLC_ALLOW_SUBAGENT_WRITE: '1' });
c.ok('TC-16.3: the escape allows the write', !denied(r));
c.contains('TC-16.3: and announces the bypass', r.json && r.json.systemMessage, 'bypassed');
c.contains('TC-16.3: the bypass message names the path', r.json && r.json.systemMessage, '.claude/instincts.md');

// --- TC-16.4: .claude/debug/<feature-slug>.md is deliberately absent from
// PROTECTED (FR-7.3, UC-16-EC1) — the guard must not fire on this path at
// all, not merely allow it: no permissionDecision field of any kind. -------
r = call(subagentPayload, '.claude/debug/some-feature.md');
c.ok('TC-16.4: subagent write to .claude/debug/some-feature.md is allowed', !denied(r), reason(r));
c.ok('TC-16.4: no permissionDecision field at all', !(r.json && r.json.hookSpecificOutput), JSON.stringify(r.json));

// --- TC-16.5: a present-but-empty agent_id targeting .claude/instincts.md
// allows with the indeterminate-origin message (UC-16-EC2) ------------------
const emptyIndicatorInstincts = JSON.parse(JSON.stringify(subagentPayload));
emptyIndicatorInstincts.agent_id = '';
r = call(emptyIndicatorInstincts, '.claude/instincts.md');
c.ok('TC-16.5: an empty indicator does not deny', !denied(r));
c.contains('TC-16.5: it says so out loud', r.json && r.json.systemMessage, 'could not determine');
c.contains('TC-16.5: naming the path', r.json && r.json.systemMessage, '.claude/instincts.md');
c.contains('TC-16.5: and names the backstops', r.json && r.json.systemMessage, 'Gate 0');

// --- the handler records its spike finding -------------------------------
const src = fs.readFileSync(path.join(HANDLERS, 'pre-agent-isolation-guard.js'), 'utf8');
c.contains('the handler records the spike finding', src, 'Spike finding:');
c.contains('the handler states the Edit/Write limit', src, 'only sees Edit and Write');

// --- TC-16.6: no Bash dispatch exists — the accepted residual stays honest
// (UC-16-EC3). The guard only ever inspects PreToolUse on Edit/Write; a
// Bash-based append bypasses it completely by construction. ----------------
c.ok('TC-16.6: no dispatch on tool_name === "Bash"', !/tool_name\s*===?\s*['"]Bash['"]/.test(src));
c.ok('TC-16.6: no property access reads tool_name at all', !/\btool_name\b\s*[.[]/.test(src) && !/input\.tool_name|toolInput\.tool_name/.test(src));
c.ok('TC-16.6: the only event comparison is the PreToolUse early return',
  /if\s*\(event !== 'PreToolUse'\) return null;/.test(src));

rimraf(scratch);
c.finish();
