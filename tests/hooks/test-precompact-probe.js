#!/usr/bin/env node
'use strict';

/**
 * `pre:compact:probe` tests.
 *
 * This hook is a diagnostic, so the properties that matter are what it does
 * NOT do. It must never block compaction, never inject context, and never let
 * a filesystem problem reach the session — a probe that disturbs the event it
 * measures is worse than no probe.
 *
 * It exists because PreCompact's payload could not be observed any other way:
 * hooks in ~/.claude/settings.json do not execute under headless `claude -p`
 * (measured, including a Stop capture that never ran), and compaction cannot
 * be forced headlessly. Plugin hooks do execute, so this is the channel.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('pre:compact:probe');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');

function probe(payload, cwd) {
  return runHook('pre:compact:probe', Object.assign(
    { hook_event_name: 'PreCompact', cwd },
    payload
  ), { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
}

function logPath(dir) {
  return path.join(dir, '.claude', 'debug', 'precompact-payload.jsonl');
}

// 1. Records the payload it receives.
{
  const dir = tempDir('sdlc-precompact-');
  const r = probe({ compact_trigger: 'auto', session_id: 's1' }, dir);
  c.equal('exits 0 on a normal payload', r.code, 0);
  c.ok('writes .claude/debug/precompact-payload.jsonl', fs.existsSync(logPath(dir)));
  const rec = JSON.parse(fs.readFileSync(logPath(dir), 'utf8').trim());
  c.equal('records compact_trigger verbatim', rec.payload.compact_trigger, 'auto');
  c.equal('records the event name', rec.payload.hook_event_name, 'PreCompact');
  c.ok('stamps an observation time', typeof rec.observed_at === 'string');
  rimraf(dir);
}

// 2. Never blocks compaction. A run that refuses to compact exhausts its
//    context instead, turning a recoverable summarisation into a dead end.
{
  const dir = tempDir('sdlc-precompact-');
  const r = probe({ compact_trigger: 'manual' }, dir);
  c.equal('exits 0 on a manual trigger', r.code, 0);
  c.ok('never emits continue:false', !/"continue"\s*:\s*false/.test(r.stdout));
  c.ok('never injects context', !/additionalContext/.test(r.stdout));
  c.ok('never emits a systemMessage', !/systemMessage/.test(r.stdout));
  rimraf(dir);
}

// 3. Appends rather than truncating, so repeated compactions all survive.
{
  const dir = tempDir('sdlc-precompact-');
  probe({ compact_trigger: 'auto' }, dir);
  probe({ compact_trigger: 'manual' }, dir);
  const lines = fs.readFileSync(logPath(dir), 'utf8').trim().split('\n');
  c.equal('appends one line per compaction', lines.length, 2);
  rimraf(dir);
}

// 4. Fail-open: an unwritable location must not disturb the session.
{
  const r = probe({ compact_trigger: 'auto' }, '/proc/nonexistent-sdlc');
  c.equal('exits 0 when the log location cannot be created', r.code, 0);
  c.ok('still does not block compaction', !/"continue"\s*:\s*false/.test(r.stdout));
}

c.finish();
