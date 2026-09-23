#!/usr/bin/env node
'use strict';

/**
 * Run-to-completion continuation check (docs/PRD.md Section 16), reached
 * through the real `stop:gate-evidence` wrapper — mirrors the style of
 * `test-stop-gate-evidence.js`: own transcript-building helpers, own scratch
 * dir, `runHook` against the actual hook process, never a require.
 *
 * Cases are numbered to match the task spec's own list (see the plan this
 * feature was implemented from); numbering is for cross-reference only, not
 * an assertion about ordering.
 */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');
const accumulator = require('../../hooks/lib/accumulator.js');

const c = new Checks('stop:gate-evidence — run-to-completion');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-cont-');

let seq = 0;

/** A fresh project directory under `scratch`, with `.claude/scratchpad.md` written (or omitted when null). */
function project(scratchpadText) {
  seq += 1;
  const root = path.join(scratch, 'proj' + seq);
  fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
  if (scratchpadText !== null && scratchpadText !== undefined) {
    fs.writeFileSync(path.join(root, '.claude', 'scratchpad.md'), scratchpadText);
  }
  return root;
}

function assistantTextRecord(text, opts) {
  const o = opts || {};
  return JSON.stringify({
    type: 'assistant',
    isSidechain: !!o.sidechain,
    session_id: o.session || 's1',
    timestamp: '2026-09-23T10:00:00Z',
    message: { role: 'assistant', content: [{ type: 'text', text: text }] },
  });
}

function assistantToolUseRecord(name, input, opts) {
  const o = opts || {};
  return JSON.stringify({
    type: 'assistant',
    isSidechain: !!o.sidechain,
    session_id: o.session || 's1',
    timestamp: '2026-09-23T10:00:00Z',
    message: { role: 'assistant', content: [{ type: 'tool_use', name: name, input: input || {} }] },
  });
}

function userCommandRecord(cmdText, opts) {
  const o = opts || {};
  return JSON.stringify({
    type: 'user',
    isSidechain: !!o.sidechain,
    session_id: o.session || 's1',
    timestamp: '2026-09-23T10:00:00Z',
    message: { role: 'user', content: cmdText },
  });
}

function transcriptFile(lines) {
  seq += 1;
  const file = path.join(scratch, 'tr' + seq + '.jsonl');
  fs.writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

function stop(cwd, file, opts) {
  const o = opts || {};
  const payload = { session_id: o.session || 's1', cwd, hook_event_name: 'Stop', transcript_path: file };
  return runHook(
    'stop:gate-evidence',
    payload,
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, o.env || {})
  );
}

const blocked = (r) => !!(r.json && r.json.decision === 'block');
const reason = (r) => (r.json && r.json.reason) || '';
const sysmsg = (r) => (r.json && r.json.systemMessage) || '';

function pendingSliceScratchpad(extraLines) {
  const lines = [
    '## Feature: Run To Completion Test',
    '## Branch: main',
    '## Status: implementing slice 5/9',
    '',
    '- [x] Slice 1: a',
    '- [x] Slice 2: b',
    '- [x] Slice 3: c',
    '- [x] Slice 4: d',
    '- [ ] Slice 5: e',
    '- [ ] Slice 6: f',
    '- [ ] Slice 7: g',
    '- [ ] Slice 8: h',
    '- [ ] Slice 9: i',
    '',
  ];
  return lines.concat(extraLines || []).join('\n');
}

function allSlicesDoneScratchpad() {
  const lines = ['## Feature: Run To Completion Test', '## Branch: main', '## Status: implementing slice 9/9', ''];
  for (let i = 1; i <= 9; i += 1) lines.push('- [x] Slice ' + i + ': s' + i);
  lines.push('');
  return lines.join('\n');
}

const scratchpadEditRecord = (d) => assistantToolUseRecord('Edit', { file_path: path.join(d, '.claude', 'scratchpad.md') });

// --- 1: blocks on a pending slice with Edit engagement ---------------------
let d = project(pendingSliceScratchpad());
let tr = transcriptFile([scratchpadEditRecord(d)]);
let r = stop(d, tr);
c.ok('1: blocks with pending slice + Edit engagement', blocked(r), reason(r));
c.contains('1: reason names Slice 5 of 9', reason(r), 'Slice 5 of 9');
c.contains('1: reason names the escape', reason(r), 'SDLC_ALLOW_MIDPLAN_STOP');
c.ok('1: never halts the response itself', r.code === 0, 'exit ' + r.code);

// --- 2: engagement via a Skill call instead of an Edit ----------------------
d = project(pendingSliceScratchpad());
tr = transcriptFile([assistantToolUseRecord('Skill', { skill: 'develop-feature' })]);
r = stop(d, tr);
c.ok('2: blocks with Skill engagement', blocked(r), reason(r));

// --- 3: engagement via a user <command-name> record -------------------------
d = project(pendingSliceScratchpad());
tr = transcriptFile([userCommandRecord('<command-name>/claude-code-sdlc:develop-feature</command-name>')]);
r = stop(d, tr);
c.ok('3: blocks with user command-name engagement', blocked(r), reason(r));

// --- 4: no engagement markers at all -> allowed -----------------------------
d = project(pendingSliceScratchpad());
tr = transcriptFile([assistantTextRecord('Some unrelated commentary about the weather.')]);
r = stop(d, tr);
c.ok('4: a stale scratchpad with no session engagement is allowed', !blocked(r), reason(r));

// --- 5: ## Status: blocked -> allowed, even with engagement -----------------
d = project(['## Feature: X', '## Branch: main', '## Status: blocked', '', '## Blockers', 'Waiting on a decision.', ''].join('\n'));
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr);
c.ok('5: status blocked is allowed', !blocked(r), reason(r));

// --- 6: ## Status: paused -> allowed ----------------------------------------
d = project(['## Feature: X', '## Branch: main', '## Status: paused', ''].join('\n'));
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr);
c.ok('6: status paused is allowed', !blocked(r), reason(r));

// --- 7: ## Status: complete -> allowed ---------------------------------------
d = project(['## Feature: X', '## Branch: main', '## Status: complete', ''].join('\n'));
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr);
c.ok('7: status complete is allowed', !blocked(r), reason(r));

// --- 8: pending slice + engaged, but a real recorded blocker -> allowed -----
d = project(pendingSliceScratchpad(['## Blockers', 'Waiting on a human decision about the schema.', '']));
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr);
c.ok('8: a recorded (non-none) blocker is allowed', !blocked(r), reason(r));

// --- 9: all slices checked -> allowed even though status still says implementing
d = project(allSlicesDoneScratchpad());
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr);
c.ok('9: no pending slice (state.slice undefined) is allowed', !blocked(r), reason(r));

// --- 10: SDLC_ALLOW_MIDPLAN_STOP=1 disables the check regardless -----------
d = project(pendingSliceScratchpad());
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr, { env: { SDLC_ALLOW_MIDPLAN_STOP: '1' } });
c.ok('10: the escape disables the check', !blocked(r), reason(r));

// --- 11: scratchpad absent entirely -> allowed ------------------------------
d = project(null);
tr = transcriptFile([scratchpadEditRecord(d)]);
r = stop(d, tr);
c.ok('11: an absent scratchpad is allowed', !blocked(r), reason(r));

// --- 12: symlinked scratchpad -> allowed; skipped where symlinks are refused
{
  const targetFile = path.join(scratch, 'symlink-target.md');
  fs.writeFileSync(targetFile, pendingSliceScratchpad());
  d = project(null);
  const linkPath = path.join(d, '.claude', 'scratchpad.md');
  let linked = true;
  try {
    fs.symlinkSync(targetFile, linkPath);
  } catch (err) {
    linked = false;
  }
  if (linked) {
    tr = transcriptFile([scratchpadEditRecord(d)]);
    r = stop(d, tr);
    c.ok('12: a symlinked scratchpad is refused, never followed -> allowed', !blocked(r), reason(r));
  } else {
    process.stdout.write('SKIP 12: symlinked scratchpad — symlink creation not permitted in this environment\n');
  }
}

// --- 13: quality-gates with a MERGE READY verdict already reported -> allowed
// (isolated from the separate MERGE-READY-evidence check via its own escape,
// so this case exercises only the continuation logic's own verdict read.)
d = project(['## Feature: X', '## Branch: main', '## Status: quality-gates', ''].join('\n'));
tr = transcriptFile([
  assistantToolUseRecord('Skill', { skill: 'merge-ready' }),
  assistantTextRecord('All nine gates pass. MERGE READY.'),
]);
r = stop(d, tr, { env: { SDLC_ALLOW_UNEVIDENCED_GATES: '1' } });
c.ok('13: quality-gates with a reported verdict is allowed', !blocked(r), reason(r));

// --- 14: quality-gates, engaged, no blockers, no verdict -> blocks ----------
d = project(['## Feature: X', '## Branch: main', '## Status: quality-gates', ''].join('\n'));
tr = transcriptFile([
  assistantToolUseRecord('Skill', { skill: 'merge-ready' }),
  assistantTextRecord('Still running the gates.'),
]);
r = stop(d, tr);
c.ok('14: quality-gates with no verdict blocks', blocked(r), reason(r));
c.contains('14: reason names the remedy', reason(r), '/merge-ready');
c.contains('14: reason names quality-gates', reason(r), 'quality-gates');

// --- 15: no-progress bound — 2 blocks, then a bounded systemMessage; a new
// key (progress) blocks again -------------------------------------------
{
  d = project(pendingSliceScratchpad());
  tr = transcriptFile([scratchpadEditRecord(d)]);
  const session = 's-noprogress';
  const r1 = stop(d, tr, { session });
  const r2 = stop(d, tr, { session });
  const r3 = stop(d, tr, { session });
  c.ok('15: 1st call on this key blocks', blocked(r1), reason(r1));
  c.ok('15: 2nd call on the same key blocks', blocked(r2), reason(r2));
  c.ok('15: 3rd call on the same key does not block', !blocked(r3), reason(r3));
  c.contains('15: 3rd call carries the no-progress systemMessage', sysmsg(r3), 'no progress since the last 2');
  c.ok('15: 3rd call never a deny', !r3.json || r3.json.decision !== 'block', reason(r3));

  // Progress: one more slice checked off, and the reported next-slice moves —
  // a new key, so the bound resets.
  fs.writeFileSync(path.join(d, '.claude', 'scratchpad.md'), pendingSliceScratchpad()
    .replace('## Status: implementing slice 5/9', '## Status: implementing slice 6/9')
    .replace('- [ ] Slice 5: e', '- [x] Slice 5: e'));
  const r4 = stop(d, tr, { session });
  c.ok('15: after real progress, a fresh key blocks again', blocked(r4), reason(r4));
}

// --- 16: fail-open — a truncated trailing transcript line is skipped -------
{
  d = project(pendingSliceScratchpad());
  const file = path.join(scratch, 'truncated-cont.jsonl');
  fs.writeFileSync(file, scratchpadEditRecord(d) + '\n{"type":"assist');
  r = stop(d, file);
  c.ok('16: a truncated final line is skipped, not fatal', blocked(r), reason(r));
  c.ok('16: exits 0', r.code === 0, 'exit ' + r.code);
}

// --- 17: fail-open — the counter cannot be persisted -> systemMessage, never
// a deny. `.claude/tmp` itself must stay a real directory (it also gates the
// earlier pathIsSafe check this module shares with `accumulator.js`), so the
// fixture instead makes the SPECIFIC per-session counter path unwritable by
// pre-creating it as a directory — the failure `writeCounter`'s own
// `fs.writeFileSync` actually hits.
{
  d = project(pendingSliceScratchpad());
  const session = 's-counter-unavailable';
  fs.mkdirSync(path.join(d, '.claude', 'tmp'), { recursive: true });
  const counterPath = path.join(d, '.claude', 'tmp', accumulator.sanitizeSessionId(session) + '.cont');
  fs.mkdirSync(counterPath);
  tr = transcriptFile([scratchpadEditRecord(d)]);
  r = stop(d, tr, { session });
  c.ok('17: an unpersistable counter never blocks', !blocked(r), reason(r));
  c.contains('17: systemMessage warns the counter cannot be tracked', sysmsg(r), 'unable to track continuation attempts');
  c.ok('17: exits 0', r.code === 0, 'exit ' + r.code);
}

// --- 18: interaction with the existing MERGE-READY check --------------------
{
  d = project(pendingSliceScratchpad());
  tr = transcriptFile([
    scratchpadEditRecord(d),
    assistantTextRecord('All nine gates pass. MERGE READY.'),
  ]);
  r = stop(d, tr);
  c.ok('18: the merge-ready deny wins when both would fire', blocked(r), reason(r));
  c.contains('18: the reason is the merge-ready one', reason(r), 'run the gates');

  r = stop(d, tr, { env: { SDLC_ALLOW_UNEVIDENCED_GATES: '1' } });
  c.ok('18: with the merge-ready escape, continuation now fires on its own', blocked(r), reason(r));
  c.contains('18: the reason is now the continuation one', reason(r), 'Run-to-completion');
}

// --- 19 (bonus): joinSystemMessages combines an advisory attribution message
// with the no-progress systemMessage -----------------------------------
{
  d = project(pendingSliceScratchpad());
  const session = 's-bonus-19';
  const plainTr = transcriptFile([scratchpadEditRecord(d)]);
  stop(d, plainTr, { session });
  stop(d, plainTr, { session });

  fs.mkdirSync(path.join(d, '.claude', 'debug', 'wave-results'), { recursive: true });
  const bonusTr = transcriptFile([
    scratchpadEditRecord(d),
    assistantToolUseRecord('Bash', {}, { sidechain: true }),
    assistantTextRecord('All nine gates pass. MERGE READY.'),
  ]);
  r = stop(d, bonusTr, { session });
  c.ok('19 (bonus): never a deny at the no-progress bound with advisory evidence', !blocked(r), reason(r));
  c.contains('19 (bonus): carries the advisory attribution message', sysmsg(r), 'advisory: gate evidence observed');
  c.contains('19 (bonus): carries the no-progress message', sysmsg(r), 'no progress since the last 2');
}

// --- 20: a FAILED slice left behind by the partial-wave policy is skipped --
{
  const text = pendingSliceScratchpad().replace('- [ ] Slice 5: e', '- [ ] Slice 5: e — FAILED (retried once)');
  d = project(text);
  tr = transcriptFile([scratchpadEditRecord(d)]);
  r = stop(d, tr);
  c.ok('20: still blocks while non-failed slices remain', blocked(r), reason(r));
  c.contains('20: points at the next slice to do, not the FAILED one', reason(r), 'next: Slice 6 of 9');
}

// --- 21: only FAILED slices remain unchecked — nothing left to continue ---
{
  const lines = ['## Feature: Run To Completion Test', '## Branch: main', '## Status: implementing slice 9/9', ''];
  for (let i = 1; i <= 8; i += 1) lines.push('- [x] Slice ' + i + ': s' + i);
  lines.push('- [ ] Slice 9: s9 FAILED', '');
  d = project(lines.join(String.fromCharCode(10)));
  tr = transcriptFile([scratchpadEditRecord(d)]);
  r = stop(d, tr);
  c.ok('21: allows when every unchecked slice is FAILED', !blocked(r), reason(r));
}

rimraf(scratch);
c.finish();
