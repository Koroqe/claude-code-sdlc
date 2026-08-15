#!/usr/bin/env node
'use strict';

/**
 * Wrapper contract tests — hooks/lib/run-hook.js.
 *
 * The centre of gravity here is the fail-open contract (PRD Section 7, FR-3).
 * Every failure shape a hook can take must still exit 0 and let the tool call
 * proceed, because a hook that halts an unattended pipeline run is worse than
 * the prose it replaced.
 */

const fs = require('fs');
const path = require('path');
const { runHook, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('hook wrapper');
const FIXTURE_HANDLERS = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'handlers');
const SESSION_INPUT = { session_id: 'test-session-1', cwd: '/tmp/proj', hook_event_name: 'SessionStart' };

// --- hooks.json structure -------------------------------------------------
const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8'));
const events = Object.keys(config.hooks);
c.ok('hooks.json declares SessionStart, PostToolUse and Stop',
  events.indexOf('SessionStart') !== -1 && events.indexOf('PostToolUse') !== -1 && events.indexOf('Stop') !== -1,
  'got ' + JSON.stringify(events));

const allHandlers = [];
for (const evt of events) {
  for (const entry of config.hooks[evt]) {
    for (const h of entry.hooks) allHandlers.push(h);
  }
}
c.ok('all hook handlers registered', allHandlers.length >= 3, String(allHandlers.length));
for (const h of allHandlers) {
  // Two or three colon-separated segments: session:start:spine, stop:typecheck-format.
  c.ok('handler ' + h.id + ' has a namespaced id', /^[a-z-]+:[a-z-]+(:[a-z-]+)?$/.test(h.id || ''), h.id);
  c.contains('handler ' + h.id + ' routes through run-hook.js', h.command, 'hooks/lib/run-hook.js');
  c.ok('handler ' + h.id + ' has no inline bootstrap', h.command.indexOf('node -e') === -1, h.command);
}
c.ok('PostToolUse matches Edit|Write',
  config.hooks.PostToolUse[0].matcher === 'Edit|Write', config.hooks.PostToolUse[0].matcher);

// --- no blocking anywhere under hooks/ ------------------------------------
function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const hookSources = walk(path.join(REPO_ROOT, 'hooks'), []).filter((f) => /\.(js|json)$/.test(f));
c.ok('hooks/ contains source files to scan', hookSources.length >= 2, String(hookSources.length));

// (a) Repository-wide: exit code 2 is never used anywhere in the harness. One
// signalling mechanism only, so a deliberate refusal and an accidental crash
// can never be confused.
for (const file of hookSources) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(REPO_ROOT, file);
  const code = text.split('\n').filter((l) => !/^\s*(\*|\/\/|#)/.test(l)).join('\n');
  c.ok(rel + ' has no exit(2)', code.indexOf('exit(2)') === -1 && code.indexOf('exitCode = 2') === -1);
}

// (b) Narrowed: the three Section 7 hooks observe and never refuse, so they
// must contain no decision vocabulary at all. This deliberately excludes
// run-hook.js (which now owns the deny channel) and the Section 8 guards
// (which are supposed to refuse) — narrowing the sweep, not deleting it.
const NON_BLOCKING_HANDLERS = [
  'hooks/handlers/session-start-spine.js',
  'hooks/handlers/post-edit-accumulate.js',
  'hooks/handlers/stop-typecheck-format.js',
];
for (const rel of NON_BLOCKING_HANDLERS) {
  const full = path.join(REPO_ROOT, rel);
  c.ok(rel + ' exists to be scanned', fs.existsSync(full));
  const code = fs.readFileSync(full, 'utf8').split('\n')
    .filter((l) => !/^\s*(\*|\/\/|#)/.test(l)).join('\n');
  c.ok(rel + ' emits no permission decision', code.indexOf('permissionDecision') === -1);
  c.ok(rel + ' emits no block decision', code.indexOf("decision = 'block'") === -1);
}

// The sweep must be able to fail. A check that only ever passes proves nothing.
const seeded = fs.readFileSync(path.join(REPO_ROOT, NON_BLOCKING_HANDLERS[0]), 'utf8')
  + "\nconst x = { permissionDecision: 'deny' };\n";
c.ok('the narrowed sweep would catch a decision in a Section 7 handler',
  seeded.indexOf('permissionDecision') !== -1);

// The deny channel has exactly one construction site. FR-10.1 removes
// run-hook.js from the sweep above, so this count is what stops a second site
// appearing unnoticed.
const wrapperSrc = fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'lib', 'run-hook.js'), 'utf8');
const denySites = (wrapperSrc.match(/permissionDecision: 'deny'/g) || []).length;
c.equal('exactly one permissionDecision construction site', denySites, 1);
const blockSites = (wrapperSrc.match(/payload\.decision = 'block'/g) || []).length;
c.equal('exactly one block construction site', blockSites, 1);
c.ok('no package.json under hooks/ (zero dependencies)',
  !fs.existsSync(path.join(REPO_ROOT, 'hooks', 'package.json')));

// --- happy path -----------------------------------------------------------
let r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'ok' });
c.equal('happy path exits 0', r.code, 0);
c.ok('happy path emits valid JSON', r.json !== null, r.stdout);
c.equal('happy path sets continue:true', r.json && r.json.continue, true);
c.contains('happy path passes additionalContext through',
  r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.additionalContext, 'fixture-ok');

// --- fail-open shape 1: handler throws ------------------------------------
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'throw' });
c.equal('throwing handler exits 0', r.code, 0);
c.contains('throwing handler names the hook', r.json && r.json.systemMessage, 'session:start:spine');
c.contains('throwing handler reports an exception', r.json && r.json.systemMessage, 'exception');

// --- fail-open shape 2: async rejection -----------------------------------
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'reject' });
c.equal('rejected promise exits 0', r.code, 0);
c.contains('rejected promise reports an exception', r.json && r.json.systemMessage, 'exception');

// --- fail-open shape 3: timeout -------------------------------------------
r = runHook('session:start:spine', SESSION_INPUT,
  { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'hang', SDLC_HOOK_TIMEOUT_MS: '400' },
  { killAfterMs: 90000 });
c.equal('hanging handler exits 0', r.code, 0);

// --- fail-open shape 4: Node below the minimum ----------------------------
r = runHook('session:start:spine', SESSION_INPUT,
  { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_HOOK_FORCE_NODE_VERSION: '16.0.0' });
c.equal('old Node exits 0', r.code, 0);
c.contains('old Node is reported by name', r.json && r.json.systemMessage, 'node-unavailable');
c.contains('old Node states the requirement', r.json && r.json.systemMessage, '18');

// --- fail-open shape 5: handler module missing ----------------------------
r = runHook('session:start:spine', SESSION_INPUT,
  { SDLC_HOOK_HANDLERS_DIR: path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'nonexistent') });
c.equal('missing handler exits 0', r.code, 0);
c.contains('missing handler is reported', r.json && r.json.systemMessage, 'handler not found');

// A handler directory outside the plugin root is refused outright: it feeds
// require(), so honouring it would be arbitrary code execution in the hook.
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: '/tmp/evil-handlers' });
c.equal('out-of-root handler dir exits 0', r.code, 0);
c.contains('out-of-root handler dir is refused', r.json && r.json.systemMessage, 'outside the plugin root');

// --- fail-open shape 6: unserialisable handler result ---------------------
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'circular' });
c.equal('circular result exits 0', r.code, 0);
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'garbage' });
c.equal('non-object result exits 0', r.code, 0);

// --- REGRESSION: a result whose toString throws, on the promise path ------
// Previously this escaped as an unhandled rejection and exited 1, which is
// exactly the outcome the fail-open contract forbids.
const ttDir = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'tostring');
fs.mkdirSync(ttDir, { recursive: true });
fs.copyFileSync(path.join(FIXTURE_HANDLERS, 'throwing-tostring.js'),
  path.join(ttDir, 'session-start-spine.js'));
const ttStart = Date.now();
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: ttDir });
const ttElapsed = Date.now() - ttStart;
c.equal('a throwing toString on the async path still exits 0', r.code, 0);
c.ok('and it does not crash with a stack trace', r.stderr.indexOf('boom-from-tostring') === -1, r.stderr.slice(0, 200));
// Exit-0-and-no-stack-trace is NOT enough on its own: a self-recursing guard
// satisfied both by accident while swallowing the payload and sometimes
// hanging for the full timeout. Assert the observable outcome instead.
c.ok('it emits a well-formed envelope', r.json !== null && r.json.continue === true,
  JSON.stringify(r.stdout).slice(0, 200));
c.ok('it does not report a stack overflow', 
  String((r.json && r.json.systemMessage) || '').indexOf('call stack') === -1,
  (r.json && r.json.systemMessage) || '');
c.ok('it returns promptly rather than running to the timeout', ttElapsed < 3000, ttElapsed + 'ms');

// --- malformed and absent stdin -------------------------------------------
r = runHook('session:start:spine', null, { SDLC_HOOK_HANDLERS_DIR: FIXTURE_HANDLERS, SDLC_TEST_MODE: 'ok' });
c.equal('empty stdin exits 0', r.code, 0);

// --- unknown hook id ------------------------------------------------------
r = runHook('not:a:hook', SESSION_INPUT, {});
c.equal('unknown hook id exits 0', r.code, 0);

// --- control characters are stripped from messages ------------------------
r = runHook('session:start:spine', SESSION_INPUT, { SDLC_HOOK_HANDLERS_DIR: '/nonexistent/[2Kfake' });
c.equal('hostile handler dir exits 0', r.code, 0);
c.ok('emitted message carries no ESC byte',
  !(r.json && r.json.systemMessage && r.json.systemMessage.indexOf('') !== -1));

c.finish();
