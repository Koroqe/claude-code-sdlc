#!/usr/bin/env node
'use strict';

/** pre:write:shrink-guard (PRD Section 8, FR-3). */

const fs = require('fs');
const path = require('path');
const { runHook, tempDir, rimraf, Checks, REPO_ROOT } = require('./harness');

const c = new Checks('pre:write:shrink-guard');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');
const scratch = tempDir('sdlc-shrink-');

function project(name, files) {
  const root = path.join(scratch, name);
  for (const [rel, lines] of Object.entries(files || {})) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, Array.from({ length: lines }, (_, i) => 'line ' + i).join('\n') + '\n');
  }
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function write(root, rel, lines, env) {
  return runHook(
    'pre:write:shrink-guard',
    {
      session_id: 's1', cwd: root, hook_event_name: 'PreToolUse', tool_name: 'Write',
      tool_input: { file_path: path.join(root, rel), content: Array.from({ length: lines }, (_, i) => 'new ' + i).join('\n') + '\n' },
    },
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {})
  );
}
function denied(r) {
  return !!(r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecision === 'deny');
}
function reason(r) {
  return (r.json && r.json.hookSpecificOutput && r.json.hookSpecificOutput.permissionDecisionReason) || '';
}

const big = project('big', {
  'docs/PRD.md': 1600,
  '.claude/scratchpad.md': 120,
  'CHANGELOG.md': 300,
  'docs/use-cases/a_use_cases.md': 500,
  'docs/qa/a_test_cases.md': 400,
  'docs/architecture.md': 900,
  'src/index.js': 800,
});

// --- the incident this guard exists for ----------------------------------
let r = write(big, 'docs/PRD.md', 200);
c.ok('a catastrophic shrink is refused', denied(r));
c.contains('reason states the old size', reason(r), '1600');
c.contains('reason states the new size', reason(r), '200');
c.contains('reason states the floor', reason(r), '640');
c.contains('reason offers Edit as the remedy', reason(r), 'Edit');
c.contains('reason names the escape', reason(r), 'SDLC_ALLOW_SHRINK');
c.contains('reason carries a deviation token', reason(r), '[deviation: rule-1');

// --- allow cases ----------------------------------------------------------
r = write(big, 'docs/PRD.md', 1650);
c.ok('growing the file is allowed', !denied(r), reason(r));
r = write(big, 'docs/PRD.md', 1400);
c.ok('a modest reduction is allowed', !denied(r), reason(r));
r = write(big, 'docs/PRD.md', 640);
c.ok('exactly at the threshold is allowed', !denied(r), reason(r));
r = write(big, 'docs/architecture.md', 10);
c.ok('a non-curated doc is not this guard\'s business', !denied(r), reason(r));
r = write(big, 'src/index.js', 5);
c.ok('source files are untouched', !denied(r), reason(r));

// --- every curated path is covered ---------------------------------------
for (const rel of ['.claude/scratchpad.md', 'CHANGELOG.md', 'docs/use-cases/a_use_cases.md', 'docs/qa/a_test_cases.md']) {
  const res = write(big, rel, 3);
  c.ok('curated path is guarded: ' + rel, denied(res));
}

// --- the 40-line floor ----------------------------------------------------
const small = project('small', { 'docs/PRD.md': 25 });
r = write(small, 'docs/PRD.md', 25);
c.ok('a short file is still held to the 40-line floor', denied(r));
c.contains('reason states the floor', reason(r), '40');
r = write(small, 'docs/PRD.md', 40);
c.ok('reaching the floor is allowed', !denied(r), reason(r));

// --- a brand-new file cannot shrink anything -----------------------------
const empty = project('empty', {});
r = write(empty, 'docs/PRD.md', 5);
c.ok('creating a new curated file is allowed', !denied(r), reason(r));

// --- escape ---------------------------------------------------------------
r = write(big, 'docs/PRD.md', 20, { SDLC_ALLOW_SHRINK: '1' });
c.ok('the escape allows the shrink', !denied(r));
c.contains('but the bypass is announced', r.json && r.json.systemMessage, 'bypassed');

// --- kill switch ----------------------------------------------------------
r = write(big, 'docs/PRD.md', 20, { SDLC_DISABLED_HOOKS: 'pre:write:shrink-guard' });
c.ok('the kill switch disables the guard', !denied(r));
c.ok('and is silent', !(r.json && r.json.systemMessage));

// --- a symlinked target is refused rather than followed ------------------
const victim = path.join(scratch, 'victim.md');
fs.writeFileSync(victim, Array.from({ length: 500 }, () => 'x').join('\n'));
const linked = project('linked', {});
fs.mkdirSync(path.join(linked, 'docs'), { recursive: true });
fs.symlinkSync(victim, path.join(linked, 'docs', 'PRD.md'));
r = write(linked, 'docs/PRD.md', 2);
c.equal('a symlinked curated file exits 0', r.code, 0);

rimraf(scratch);
c.finish();
