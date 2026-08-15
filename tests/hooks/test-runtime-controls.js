#!/usr/bin/env node
'use strict';

/**
 * Runtime control tests — the kill switch, the per-id disable list and the
 * profile gate (PRD Section 7, FR-4).
 *
 * These use a recorder fixture that writes a marker file when it actually
 * runs. Asserting on stdout alone cannot distinguish "suppressed" from "ran
 * and returned nothing" — both are an empty envelope. The marker file can.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('hook runtime controls');
const RECORDERS = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'recorders');
const IDS = ['session:start:spine', 'post:edit:accumulate', 'stop:typecheck-format'];
const scratch = tempDir('sdlc-controls-');

/** Run a hook with a fresh marker file; return true if the handler executed. */
function didRun(hookId, env) {
  const marker = path.join(scratch, 'marker-' + Math.random().toString(36).slice(2));
  const result = runHook(
    hookId,
    { session_id: 's1', cwd: scratch, hook_event_name: 'Test' },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: RECORDERS, SDLC_TEST_MARKER: marker }, env || {})
  );
  return { ran: fs.existsSync(marker), code: result.code, json: result.json };
}

// --- baseline: with no controls set, every hook runs ----------------------
for (const id of IDS) {
  const r = didRun(id, {});
  c.ok('baseline: ' + id + ' runs', r.ran);
  c.equal('baseline: ' + id + ' exits 0', r.code, 0);
}

// --- SDLC_HOOKS_ENABLED=0 disables everything ----------------------------
for (const id of IDS) {
  const r = didRun(id, { SDLC_HOOKS_ENABLED: '0' });
  c.ok('kill switch suppresses ' + id, !r.ran);
  c.equal('kill switch keeps exit 0 for ' + id, r.code, 0);
  c.ok('kill switch is silent for ' + id, !(r.json && r.json.systemMessage),
    JSON.stringify(r.json));
}

// Only the literal "0" disables — "false"/"no"/"" must not.
for (const value of ['false', 'no', '1', '']) {
  const r = didRun('session:start:spine', { SDLC_HOOKS_ENABLED: value });
  c.ok('SDLC_HOOKS_ENABLED=' + JSON.stringify(value) + ' does not disable', r.ran);
}

// --- SDLC_DISABLED_HOOKS disables exactly the listed id -------------------
let r = didRun('session:start:spine', { SDLC_DISABLED_HOOKS: 'session:start:spine' });
c.ok('disable list suppresses the named hook', !r.ran);
r = didRun('post:edit:accumulate', { SDLC_DISABLED_HOOKS: 'session:start:spine' });
c.ok('disable list leaves other hooks running', r.ran);

r = didRun('post:edit:accumulate', { SDLC_DISABLED_HOOKS: 'session:start:spine, post:edit:accumulate' });
c.ok('disable list tolerates whitespace around entries', !r.ran);

r = didRun('session:start:spine', { SDLC_DISABLED_HOOKS: 'session:start' });
c.ok('disable list matches whole ids only, not prefixes', r.ran);

// --- profile gating -------------------------------------------------------
// minimal = observe session state only; never execute project-declared commands.
r = didRun('session:start:spine', { SDLC_HOOK_PROFILE: 'minimal' });
c.ok('minimal profile keeps the spine hook', r.ran);
r = didRun('stop:typecheck-format', { SDLC_HOOK_PROFILE: 'minimal' });
c.ok('minimal profile drops the command-executing hook', !r.ran);
r = didRun('post:edit:accumulate', { SDLC_HOOK_PROFILE: 'minimal' });
c.ok('minimal profile drops the accumulator', !r.ran);

for (const profile of ['standard', 'strict']) {
  for (const id of IDS) {
    const res = didRun(id, { SDLC_HOOK_PROFILE: profile });
    c.ok(profile + ' profile runs ' + id, res.ran);
  }
}

// An invalid profile falls back to standard rather than failing: a typo in an
// env var must not silently change which hooks enforce.
for (const id of IDS) {
  const res = didRun(id, { SDLC_HOOK_PROFILE: 'turbo' });
  c.ok('invalid profile falls back to standard for ' + id, res.ran);
  c.equal('invalid profile keeps exit 0 for ' + id, res.code, 0);
}

// --- the kill switch outranks a malfunctioning handler --------------------
const throwers = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'handlers');
r = runHook('session:start:spine', { session_id: 's1', cwd: scratch },
  { SDLC_HOOK_HANDLERS_DIR: throwers, SDLC_TEST_MODE: 'throw', SDLC_HOOKS_ENABLED: '0' });
c.equal('kill switch short-circuits before a throwing handler', r.code, 0);
c.ok('kill switch emits no failure note', !(r.json && r.json.systemMessage), JSON.stringify(r.json));

rimraf(scratch);
c.finish();
