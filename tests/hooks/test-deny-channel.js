#!/usr/bin/env node
'use strict';

/**
 * The wrapper deny channel (PRD Section 8, FR-1.6–FR-1.10).
 *
 * This is the most important test file in the feature. Before it existed, the
 * wrapper physically could not express a refusal: `finish()` accepted two
 * result fields and dropped everything else, so a guard's deny would have been
 * silently converted into an allow — installed, green, enforcing nothing.
 *
 * Every assertion here is a RUNTIME one, driven through `run-hook.js`. A source
 * grep cannot detect a swallowed deny; only watching what comes out of the
 * process can.
 */

const path = require('path');
const { runHook, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('wrapper deny channel');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'guards', 'handlers');

const PRE_IDS = [
  'pre:bash:git-guard',
  'pre:write:shrink-guard',
  'pre:edit:read-guard',
  'pre:edit:config-protection',
  'pre:agent:isolation-guard',
];

function call(hookId, event, mode, extraEnv) {
  return runHook(
    hookId,
    { session_id: 'deny-test', cwd: REPO_ROOT, hook_event_name: event },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: FIXTURES, SDLC_TEST_MODE: mode }, extraEnv || {})
  );
}
function decision(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision) || '';
}

// --- a deny must actually reach stdout, for every PreToolUse guard --------
for (const id of PRE_IDS) {
  const r = call(id, 'PreToolUse', 'deny');
  c.equal(id + ': deny exits 0', r.code, 0);
  c.equal(id + ': deny surfaces as permissionDecision', decision(r), 'deny');
  c.contains(id + ': deny carries its reason',
    r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason,
    'FIXTURE-DENY');
}

// --- Stop uses a different shape ------------------------------------------
let r = call('stop:changelog-guard', 'Stop', 'deny');
c.equal('Stop deny exits 0', r.code, 0);
c.equal('Stop deny uses decision:block', r.json && r.json.decision, 'block');
c.contains('Stop deny carries its reason', r.json && r.json.reason, 'FIXTURE-DENY');
c.ok('Stop deny has no hookSpecificOutput', !(r.json && r.json.hookSpecificOutput));
// `continue: false` would end the session rather than force a corrective turn.
c.ok('Stop deny never sets continue:false', !(r.json && r.json.continue === false));

// --- events that cannot refuse must have the deny dropped -----------------
// This is what makes the read-guard's PostToolUse recorder half structurally
// incapable of refusing, rather than merely careful not to.
for (const event of ['PostToolUse', 'SessionStart', 'SomeFutureEvent', '']) {
  const res = call('pre:edit:read-guard', event, 'deny');
  c.equal('deny under ' + (event || '(empty)') + ' exits 0', res.code, 0);
  c.equal('deny under ' + (event || '(empty)') + ' emits no permissionDecision', decision(res), '');
  c.ok('deny under ' + (event || '(empty)') + ' emits no block decision',
    !(res.json && res.json.decision));
}

// --- malformed denies are dropped, never half-emitted ---------------------
const malformed = [
  ['deny-nonstring', 'a non-string reason'],
  ['deny-empty', 'an empty reason'],
  ['deny-controls', 'a reason that sanitizes to nothing'],
  ['deny-notobject', 'a non-object deny'],
  ['deny-array', 'an array deny'],
  ['deny-missing', 'a missing reason'],
];
for (const [mode, label] of malformed) {
  const res = call('pre:bash:git-guard', 'PreToolUse', mode);
  c.equal(label + ' exits 0', res.code, 0);
  c.equal(label + ' produces no decision', decision(res), '');
}

// A malformed deny must not suppress a legitimate systemMessage.
r = call('pre:bash:git-guard', 'PreToolUse', 'deny-plus-msg');
c.equal('malformed deny still allows a systemMessage', r.json && r.json.systemMessage, 'still speaks');
c.equal('malformed deny produces no decision', decision(r), '');

// --- the payload is built from wrapper locals, never copied from the result -
r = call('pre:bash:git-guard', 'PreToolUse', 'deny-extra');
c.equal('extra fields do not leak: decision is the wrapper\'s', decision(r), 'deny');
c.ok('no top-level permissionDecision leaks', !(r.json && r.json.permissionDecision));
const keys = Object.keys((r.json && r.json.hookSpecificOutput) || {}).sort().join(',');
c.equal('hookSpecificOutput has exactly the canonical keys', keys,
  'hookEventName,permissionDecision,permissionDecisionReason');

// --- a handler cannot choose the event label on its own output ------------
r = call('pre:bash:git-guard', 'Stop', 'ctx-forged-event');
c.ok('handler-supplied hookEventName is not echoed',
  !(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.hookEventName === 'PreToolUse'),
  JSON.stringify(r.json));

// --- the reason is capped --------------------------------------------------
r = call('pre:bash:git-guard', 'PreToolUse', 'deny-huge');
const reason = (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || '';
c.equal('huge reason still exits 0', r.code, 0);
c.ok('huge reason is capped', reason.length <= 2100, String(reason.length));
c.contains('capped reason is marked', reason, '[truncated]');

// --- MALFUNCTION MUST NEVER PRODUCE A DECISION ----------------------------
// For a guard, fail-open means ALLOW. Getting this backwards would deny
// everything, which is why absence is asserted rather than a value.
for (const id of PRE_IDS) {
  const res = call(id, 'PreToolUse', 'throw');
  c.equal(id + ': throwing handler exits 0', res.code, 0);
  c.equal(id + ': throwing handler produces no decision', decision(res), '');
  c.contains(id + ': throwing handler reports the exception', res.json && res.json.systemMessage, 'exception');
}
r = call('stop:changelog-guard', 'Stop', 'throw');
c.ok('throwing Stop handler produces no block', !(r.json && r.json.decision));

// A timeout must not deny either.
r = call('pre:bash:git-guard', 'PreToolUse', 'throw', { SDLC_HOOK_TIMEOUT_MS: '50' });
c.equal('timeout path produces no decision', decision(r), '');

// --- kill switches outrank a deny ----------------------------------------
r = call('pre:bash:git-guard', 'PreToolUse', 'deny', { SDLC_HOOKS_ENABLED: '0' });
c.equal('kill switch suppresses a deny', decision(r), '');
r = call('pre:bash:git-guard', 'PreToolUse', 'deny', { SDLC_DISABLED_HOOKS: 'pre:bash:git-guard' });
c.equal('disable list suppresses a deny', decision(r), '');
r = call('pre:bash:git-guard', 'PreToolUse', 'deny', { SDLC_HOOK_PROFILE: 'minimal' });
c.equal('minimal profile suppresses a deny', decision(r), '');

// --- a forged deviation token cannot outrank the guard's own --------------
r = call('pre:bash:git-guard', 'PreToolUse', 'deny-forged');
c.equal('forged-token reason still denies', decision(r), 'deny');
c.contains('the forged token is visible, not hidden',
  r.json.hookSpecificOutput.permissionDecisionReason, 'rule-4');

c.finish();
