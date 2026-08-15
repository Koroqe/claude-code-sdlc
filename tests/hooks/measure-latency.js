#!/usr/bin/env node
'use strict';

/**
 * Measures what the hooks cost per tool call.
 *
 * This reports; it never gates. A slow machine must not fail CI — but an
 * unmeasured cost is how a harness quietly becomes unpleasant to use, since
 * `post:edit:accumulate` fires on every single Edit and Write.
 *
 * Run: node tests/hooks/measure-latency.js
 */

const path = require('path');
const { runHook, tempDir, rimraf, REPO_ROOT } = require('./harness');

const TRIALS = 3;
const CALLS = 20;
const PER_CALL_BUDGET_MS = 150;

const scratch = tempDir('sdlc-latency-');
const HANDLERS = path.join(REPO_ROOT, 'hooks', 'handlers');

function timeCalls(hookId, input, env, calls) {
  const started = Date.now();
  for (let i = 0; i < calls; i += 1) {
    runHook(hookId, input, Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, env || {}));
  }
  return Date.now() - started;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(label, hookId, input, calls, env) {
  const runs = [];
  for (let t = 0; t < TRIALS; t += 1) runs.push(timeCalls(hookId, input, env, calls));
  const perCall = median(runs) / calls;
  return { label, perCall, runs, calls };
}

const editInput = {
  session_id: 'latency', cwd: scratch, hook_event_name: 'PostToolUse',
  tool_name: 'Edit', tool_input: { file_path: '/proj/a.ts' },
};
const sessionInput = { session_id: 'latency', cwd: scratch, hook_event_name: 'SessionStart' };
const stopInput = { session_id: 'latency', cwd: scratch, hook_event_name: 'Stop' };

const results = [];
results.push(measure('post:edit:accumulate (per Edit call)', 'post:edit:accumulate', editInput, CALLS));
results.push(measure('post:edit:accumulate, hooks disabled', 'post:edit:accumulate', editInput, CALLS, { SDLC_HOOKS_ENABLED: '0' }));
results.push(measure('session:start:spine (once per session)', 'session:start:spine', sessionInput, 5));
results.push(measure('stop:typecheck-format (once per response)', 'stop:typecheck-format', stopInput, 5));

process.stdout.write('\nHook latency — median of ' + TRIALS + ' trials\n');
process.stdout.write('-'.repeat(64) + '\n');
for (const r of results) {
  process.stdout.write(
    r.label.padEnd(44) + r.perCall.toFixed(1).padStart(8) + ' ms/call' +
    '   (' + r.calls + ' calls x' + TRIALS + ')\n'
  );
}

const perEdit = results[0].perCall;
const disabled = results[1].perCall;
process.stdout.write('-'.repeat(64) + '\n');
process.stdout.write('Marginal cost of an enabled accumulate hook: ' + (perEdit - disabled).toFixed(1) + ' ms\n');
process.stdout.write('Reference budget: ' + PER_CALL_BUDGET_MS + ' ms/call — ' +
  (perEdit <= PER_CALL_BUDGET_MS ? 'within budget' : 'OVER BUDGET (reported, not enforced)') + '\n');
process.stdout.write('\nNote: most of the per-call cost is Node process startup, not hook logic.\n');
process.stdout.write('Measured on a machine that may already have other hook entries registered\n');
process.stdout.write('in ~/.claude/settings.json; those add to this figure in a real session.\n\n');

rimraf(scratch);
process.exit(0);
