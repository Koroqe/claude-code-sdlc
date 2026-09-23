'use strict';

/**
 * stop:gate-evidence — the two subagent-detection sources added for Claude
 * Code 2.1.280 (measured: the main transcript carries ZERO `isSidechain`
 * records on that build; see docs/findings/subagent-transcripts-2.1.280.md).
 *
 * Kept in its own file, separate from test-stop-gate-evidence.js: on this
 * Windows machine, some of that file's pre-existing symlink cases crash with
 * EPERM partway through, which stops later cases in THAT process from
 * running. run-tests.js spawns each test-*.js as its own process, so a
 * separate file guarantees these cases execute regardless.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('stop:gate-evidence (2.1.280 subagent sources)');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');

let seq = 0;

function writeTranscript(dir, records) {
  seq += 1;
  const file = path.join(dir, 'transcript' + seq + '.jsonl');
  fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
}

function assistantText(text) {
  return {
    type: 'assistant',
    isSidechain: false,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  };
}

/** A `user` record closing out a tool call, optionally carrying a
 *  top-level `toolUseResult` (the harness-written field, source (b)). */
function userToolResult(toolUseResult) {
  const rec = {
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: [] }] },
  };
  if (toolUseResult !== undefined) rec.toolUseResult = toolUseResult;
  return rec;
}

/** The sibling `<transcript minus .jsonl>/subagents/` directory (source (c)). */
function subagentsDirFor(transcriptFile) {
  const base = transcriptFile.slice(0, -'.jsonl'.length);
  return path.join(base, 'subagents');
}

function stop(dir, file, env) {
  return runHook(
    'stop:gate-evidence',
    { session_id: 's1', cwd: dir, hook_event_name: 'Stop', transcript_path: file },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {})
  );
}

const blocked = (r) => !!(r.json && r.json.decision === 'block');
const reason = (r) => (r.json && r.json.reason) || '';

// --- source (b): toolUseResult.agentId is sufficient evidence -------------
let dir = tempDir('sdlc-gate-evidence-src-');
let file = writeTranscript(dir, [
  assistantText('Dispatching the gate agents.'),
  userToolResult({ status: 'ok', agentId: 'agent-abc123', agentType: 'code-reviewer' }),
  assistantText('All nine gates pass. MERGE READY.'),
]);
let r = stop(dir, file);
c.ok('toolUseResult.agentId counts as evidence: verdict allowed', !blocked(r), reason(r));
rimraf(dir);

// --- source (b) negatives: not evidence, guard still fires -----------------
dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [userToolResult({ status: 'ok', agentId: '' }), assistantText('MERGE READY')]);
r = stop(dir, file);
c.ok('empty-string agentId is not evidence: still blocks', blocked(r), reason(r));
rimraf(dir);

dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [userToolResult({ status: 'ok', agentId: 12345 }), assistantText('MERGE READY')]);
r = stop(dir, file);
c.ok('non-string agentId is not evidence: still blocks', blocked(r), reason(r));
rimraf(dir);

dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [userToolResult('not-an-object'), assistantText('MERGE READY')]);
r = stop(dir, file);
c.ok('non-object toolUseResult is not evidence: still blocks', blocked(r), reason(r));
rimraf(dir);

dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [userToolResult({ status: 'ok' }), assistantText('MERGE READY')]);
r = stop(dir, file);
c.ok('toolUseResult with no agentId key is not evidence: still blocks', blocked(r), reason(r));
rimraf(dir);

// --- source (c): sibling subagents/agent-*.jsonl is sufficient evidence ----
dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [assistantText('All nine gates pass. MERGE READY.')]);
let subDir = subagentsDirFor(file);
fs.mkdirSync(subDir, { recursive: true });
fs.writeFileSync(path.join(subDir, 'agent-abc.jsonl'), '{"type":"assistant"}\n');
r = stop(dir, file);
c.ok('sibling subagents/agent-*.jsonl counts as evidence: verdict allowed', !blocked(r), reason(r));
rimraf(dir);

// --- source (c) negative: only non-matching filenames in subagents/ --------
dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [assistantText('MERGE READY')]);
subDir = subagentsDirFor(file);
fs.mkdirSync(subDir, { recursive: true });
fs.writeFileSync(path.join(subDir, 'notes.txt'), 'not a subagent transcript');
r = stop(dir, file);
c.ok('subagents/ with only non-matching names is not evidence: still blocks', blocked(r), reason(r));
rimraf(dir);

// --- source (c) negative: subagents path is a regular file, not a dir ------
dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [assistantText('MERGE READY')]);
const subPath = subagentsDirFor(file);
fs.mkdirSync(path.dirname(subPath), { recursive: true });
fs.writeFileSync(subPath, 'a file, not a directory');
r = stop(dir, file);
c.ok(
  'subagents path as a regular file is not evidence, no throw',
  blocked(r) && r.code === 0,
  'exit ' + r.code + ' — ' + reason(r)
);
rimraf(dir);

// --- none of the three sources: the original protection must still hold ---
dir = tempDir('sdlc-gate-evidence-src-');
file = writeTranscript(dir, [
  assistantText('Running the gates now.'),
  assistantText('All nine gates pass. MERGE READY.'),
]);
r = stop(dir, file);
c.ok('no evidence from any of the three sources: blocks', blocked(r), reason(r));
c.ok(
  'block reason text unchanged',
  /no subagent ran at any point in this session/.test(reason(r)),
  reason(r)
);
rimraf(dir);

c.finish();
