'use strict';

/**
 * stop:gate-evidence.
 *
 * This hook accuses, so the false-positive cases matter more than the true
 * one. A guard that fires on honest work gets switched off, and a switched-off
 * guard protects nothing. Most of what follows is therefore negative cases:
 * the many ways a response can mention the verdict without asserting it.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('stop:gate-evidence');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-gate-evidence-');

let seq = 0;

/** Build a transcript from (isSidechain, text) pairs and return its path. */
function transcript(records) {
  seq += 1;
  const file = path.join(scratch, 't' + seq + '.jsonl');
  const lines = records.map((r) =>
    JSON.stringify({
      type: 'assistant',
      isSidechain: !!r.sidechain,
      timestamp: '2026-08-20T10:00:00Z',
      message: {
        role: 'assistant',
        content: r.tool
          ? [{ type: 'tool_use', name: 'Bash', input: {} }]
          : [{ type: 'text', text: r.text || '' }],
      },
    })
  );
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

function stop(file, env) {
  return runHook(
    'stop:gate-evidence',
    { session_id: 's1', cwd: scratch, hook_event_name: 'Stop', transcript_path: file },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {})
  );
}

const blocked = (r) => !!(r.json && r.json.decision === 'block');
const reason = (r) => (r.json && r.json.reason) || '';

// --- the case this exists to catch ---------------------------------------
let r = stop(transcript([
  { text: 'Running the gates now.' },
  { text: 'All nine gates pass. **MERGE READY**.' },
]));
c.ok('blocks a MERGE READY verdict with no subagent in the session', blocked(r), reason(r));
c.ok('names the remedy', /run the gates/i.test(reason(r)), reason(r));
c.ok('names its escape', reason(r).indexOf('SDLC_ALLOW_UNEVIDENCED_GATES') !== -1, reason(r));
c.ok('carries a deviation classification', /deviation: rule-1/.test(reason(r)), reason(r));
c.ok('never halts the response itself', r.code === 0, 'exit ' + r.code);

// --- the case that must never be blocked ---------------------------------
r = stop(transcript([
  { text: 'Dispatching the gate agents.' },
  { sidechain: true, text: 'code-reviewer: no blocking findings.' },
  { text: 'All nine gates pass. MERGE READY.' },
]));
c.ok('allows a verdict when a subagent actually ran', !blocked(r), reason(r));

r = stop(transcript([
  { sidechain: true, tool: true },
  { text: 'MERGE READY' },
]));
c.ok('a subagent that only used tools still counts as evidence', !blocked(r), reason(r));

// --- mentioning the verdict is not claiming it ---------------------------
r = stop(transcript([{ text: 'Gate 4 failed, so this is NOT MERGE READY yet.' }]));
c.ok('a NOT MERGE READY report is not a claim', !blocked(r), reason(r));

r = stop(transcript([{ text: 'Two gates still failing — not yet merge ready.' }]));
c.ok('"not yet merge ready" is not a claim', !blocked(r), reason(r));

r = stop(transcript([{ text: 'The pipeline finishes by reporting a verdict.' }]));
c.ok('discussing the pipeline without the phrase is not a claim', !blocked(r), reason(r));

// --- fail-open: uncertainty must never accuse ----------------------------
r = stop(path.join(scratch, 'does-not-exist.jsonl'));
c.ok('an unreadable transcript does not block', !blocked(r), reason(r));
c.ok('an unreadable transcript still exits 0', r.code === 0, 'exit ' + r.code);

r = runHook(
  'stop:gate-evidence',
  { session_id: 's1', cwd: scratch, hook_event_name: 'Stop' },
  { SDLC_HOOK_HANDLERS_DIR: HANDLERS }
);
c.ok('a payload with no transcript path does not block', !blocked(r), reason(r));

const truncated = path.join(scratch, 'truncated.jsonl');
fs.writeFileSync(truncated, JSON.stringify({
  type: 'assistant', isSidechain: false,
  message: { role: 'assistant', content: [{ type: 'text', text: 'MERGE READY' }] },
}) + '\n{"type":"assist');
r = stop(truncated);
c.ok('a truncated final line is skipped, not fatal', blocked(r), reason(r));

r = stop(transcript([{ text: 'MERGE READY' }]), { SDLC_ALLOW_UNEVIDENCED_GATES: '1' });
c.ok('the escape switch disables the guard', !blocked(r), reason(r));

r = stop(transcript([{ text: 'MERGE READY' }]), { SDLC_DISABLED_HOOKS: 'stop:gate-evidence' });
c.ok('SDLC_DISABLED_HOOKS disables it by id', !blocked(r), reason(r));

// --- an empty session has nothing to judge -------------------------------
r = stop(transcript([{ sidechain: true, text: 'work' }]));
c.ok('no verdict means no opinion', !blocked(r), reason(r));

rimraf(scratch);
c.finish();
