#!/usr/bin/env node
'use strict';

/**
 * `subagent:stop:wave-record` tests.
 *
 * The hook exists because a wave subagent's self-report is the wrong source
 * for whether its Verify command passed. The load-bearing case here is the one
 * where the transcript and the summary DISAGREE — the transcript records an
 * errored tool result while the closing text claims all checks pass. If this
 * hook cannot surface that, it has no reason to exist.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('subagent:stop:wave-record');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const TRANSCRIPTS = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks', 'transcripts');

function record(transcript, agentId, cwd) {
  return runHook('subagent:stop:wave-record', {
    hook_event_name: 'SubagentStop',
    cwd,
    agent_id: agentId,
    agent_transcript_path: transcript === null ? undefined : path.join(TRANSCRIPTS, transcript),
  }, { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
}
function readRecord(cwd, id) {
  return JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'debug', 'wave-results', id + '.json'), 'utf8'));
}

// 1. A passing slice is recorded faithfully.
{
  const dir = tempDir('sdlc-wave-');
  const r = record('subagent-verify-pass.jsonl', 'agent-1', dir);
  c.equal('exits 0', r.code, 0);
  const rec = readRecord(dir, 'agent-1');
  c.equal('records the errored-result count as zero', rec.tool_results_errored, 0);
  c.ok('captures the Verify command it ran',
    rec.commands.some((x) => x.indexOf('run-tests.js') !== -1));
  c.ok('captures the file it edited', rec.files_written.indexOf('src/services/widgets.ts') !== -1);
  c.equal('counts the Edit tool use', rec.tool_counts.Edit, 1);
  c.ok('captures the closing summary', /Verify passed/.test(rec.final_text));
  rimraf(dir);
}

// 2. THE case: transcript says the Verify errored, the subagent says it passed.
{
  const dir = tempDir('sdlc-wave-');
  record('subagent-verify-fail.jsonl', 'agent-2', dir);
  const rec = readRecord(dir, 'agent-2');
  c.equal('an errored tool result is counted', rec.tool_results_errored, 1);
  c.ok('even though the summary claims success', /All checks pass/.test(rec.final_text));
  c.ok('so the record contradicts the self-report, which is the point',
    rec.tool_results_errored > 0 && /All checks pass/.test(rec.final_text));
  c.ok('and the out-of-surface write is visible',
    rec.files_written.indexOf('src/routes/admin.ts') !== -1);
  rimraf(dir);
}

// 3. A crashed subagent leaves a half-written line; the rest must survive.
{
  const dir = tempDir('sdlc-wave-');
  const r = record('subagent-truncated.jsonl', 'agent-3', dir);
  c.equal('exits 0 on a truncated transcript', r.code, 0);
  const rec = readRecord(dir, 'agent-3');
  c.ok('recovers the records before the break', rec.commands.length >= 1);
  rimraf(dir);
}

// 4. Never blocks, whatever it reads.
{
  const dir = tempDir('sdlc-wave-');
  for (const f of ['subagent-verify-pass.jsonl', 'subagent-verify-fail.jsonl', 'subagent-truncated.jsonl']) {
    const r = record(f, 'agent-x', dir);
    c.ok('never emits continue:false for ' + f, !/"continue"\s*:\s*false/.test(r.stdout));
    c.ok('never injects context for ' + f, !/additionalContext/.test(r.stdout));
  }
  rimraf(dir);
}

// 5. Fail-open on a missing or absent transcript path.
{
  const dir = tempDir('sdlc-wave-');
  c.equal('exits 0 when agent_transcript_path is absent', record(null, 'agent-4', dir).code, 0);
  const r = runHook('subagent:stop:wave-record', {
    hook_event_name: 'SubagentStop', cwd: dir, agent_id: 'agent-5',
    agent_transcript_path: path.join(dir, 'does-not-exist.jsonl'),
  }, { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
  c.equal('exits 0 when the transcript does not exist', r.code, 0);
  rimraf(dir);
}

// 6. agent_id arrives on stdin and becomes a filename — it must be constrained.
{
  const dir = tempDir('sdlc-wave-');
  record('subagent-verify-pass.jsonl', '../../escaped', dir);
  const inside = path.join(dir, '.claude', 'debug', 'wave-results');
  const files = fs.existsSync(inside) ? fs.readdirSync(inside) : [];
  c.ok('a traversal-shaped agent_id is sanitised, not interpolated raw',
    files.length === 1 && files[0].indexOf('..') === -1 && files[0].indexOf('/') === -1);
  c.ok('and nothing is written outside the wave-results directory',
    !fs.existsSync(path.join(dir, 'escaped.json')));
  rimraf(dir);
}

c.finish();
