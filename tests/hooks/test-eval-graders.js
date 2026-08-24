#!/usr/bin/env node
'use strict';

/**
 * Unit tests for the behavioural-eval grading logic (scripts/eval/graders.js).
 *
 * Lives under tests/hooks/ so it self-registers into the documented sweep
 * (`tests/hooks/test-*.js`) and runs in CI — it is harness plumbing, like the
 * hook tests around it, even though it grades sessions rather than hooks.
 *
 * The point of this file: the expensive half of the eval (running `claude -p`)
 * costs money and cannot run in CI, so the CHEAP half — the graders that decide
 * pass/fail — must be provably correct for free. Every grader type is exercised
 * both ways: it must PASS on a good transcript and FAIL on a seeded broken one.
 * A grader that only ever passes is not evidence.
 */

const { parseStream, runGrader, gradeCase } = require('../../scripts/eval/graders.js');
const { Checks } = require('./harness');

const c = new Checks('eval graders');

/** Build a stream-json capture the way `claude -p --output-format stream-json` emits it. */
function stream(blocks, resultText) {
  const lines = [JSON.stringify({ type: 'system', subtype: 'init' })];
  for (const b of blocks) {
    lines.push(JSON.stringify({ type: 'assistant', message: { content: [b] } }));
  }
  if (resultText !== undefined) {
    lines.push(JSON.stringify({ type: 'result', result: resultText }));
  }
  return lines.join('\n') + '\n';
}
const text = (t) => ({ type: 'text', text: t });
const tool = (name, input) => ({ type: 'tool_use', name, input: input || {} });

// --- parseStream ----------------------------------------------------------
const parsed = parseStream(stream(
  [text('tier: fast — single-file copy edit'), tool('Edit', { file_path: 'README.md' })],
  'done'
));
c.contains('parse: collects assistant text', parsed.assistantText, 'tier: fast');
c.equal('parse: collects tool uses', parsed.toolUses.length, 1);
c.equal('parse: names the tool', parsed.toolUses[0].name, 'Edit');
c.equal('parse: captures the result text', parsed.finalText, 'done');

// Robustness: malformed lines are skipped, never fatal — a truncated capture
// must still grade rather than crash the whole run.
const noisy = parseStream('not json\n{"type":"assistant","message":{"content":[' +
  JSON.stringify(text('tier: full')) + ']}}\n{oops\n');
c.contains('parse: survives noise around valid lines', noisy.assistantText, 'tier: full');
c.equal('parse: counts malformed lines', noisy.malformed, 1);
c.equal('parse: empty input yields empty parse', parseStream('').toolUses.length, 0);
c.equal('parse: null input does not throw', parseStream(null).lines, 0);

// --- regex grader ---------------------------------------------------------
const fastRun = parseStream(stream([text('tier: fast — single-file copy edit, no sensitive path')]));
c.ok('regex: matches when present',
  runGrader({ type: 'regex', pattern: 'tier:\\s*fast' }, fastRun, []).pass);
c.ok('regex: SEEDED BROKEN — fails when the pattern is absent',
  !runGrader({ type: 'regex', pattern: 'tier:\\s*quick' }, fastRun, []).pass);
c.ok('regex: not_contains passes when absent',
  runGrader({ type: 'regex', pattern: 'tier:\\s*full', match: 'not_contains' }, fastRun, []).pass);
c.ok('regex: SEEDED BROKEN — not_contains fails when present',
  !runGrader({ type: 'regex', pattern: 'tier:\\s*fast', match: 'not_contains' }, fastRun, []).pass);
c.ok('regex: an invalid pattern FAILS rather than silently passing',
  !runGrader({ type: 'regex', pattern: '([unclosed' }, fastRun, []).pass);

// --- tool_used grader -----------------------------------------------------
const twoEdits = parseStream(stream([
  tool('Edit', { file_path: 'a.js' }),
  tool('Edit', { file_path: 'b.js' }),
  tool('Read', { file_path: 'c.js' }),
]));
c.ok('tool_used: satisfied by one or more uses',
  runGrader({ type: 'tool_used', tool: 'Read' }, twoEdits, []).pass);
c.ok('tool_used: SEEDED BROKEN — fails for a tool never used',
  !runGrader({ type: 'tool_used', tool: 'WebFetch' }, twoEdits, []).pass);
c.ok('tool_used: max bound is enforced',
  !runGrader({ type: 'tool_used', tool: 'Edit', max: 1 }, twoEdits, []).pass);
c.ok('tool_used: input_match narrows to the right call',
  runGrader({ type: 'tool_used', tool: 'Edit', input_match: 'b\\.js' }, twoEdits, []).pass);
c.ok('tool_used: SEEDED BROKEN — input_match that matches nothing fails',
  !runGrader({ type: 'tool_used', tool: 'Edit', input_match: 'zzz\\.js' }, twoEdits, []).pass);

// --- no_edits grader ------------------------------------------------------
const readOnly = parseStream(stream([tool('Read', {}), tool('Grep', {})]));
c.ok('no_edits: passes when nothing was mutated', runGrader({ type: 'no_edits' }, readOnly, []).pass);
c.ok('no_edits: SEEDED BROKEN — fails when an Edit happened',
  !runGrader({ type: 'no_edits' }, twoEdits, []).pass);
c.ok('no_edits: Write counts as a mutation',
  !runGrader({ type: 'no_edits' }, parseStream(stream([tool('Write', {})])), []).pass);

// --- file_written grader --------------------------------------------------
const files = ['docs/PRD.md', 'src/format.js'];
c.ok('file_written: matches a written path',
  runGrader({ type: 'file_written', pattern: 'docs/PRD' }, readOnly, files).pass);
c.ok('file_written: SEEDED BROKEN — fails for a path never written',
  !runGrader({ type: 'file_written', pattern: 'docs/qa' }, readOnly, files).pass);
c.ok('file_written: not_contains passes when absent',
  runGrader({ type: 'file_written', pattern: 'docs/qa', match: 'not_contains' }, readOnly, files).pass);

// --- unknown / malformed grader configs must FAIL LOUDLY ------------------
c.ok('unknown grader type fails rather than passing by default',
  !runGrader({ type: 'nonsense' }, readOnly, []).pass);
c.ok('a non-object grader fails', !runGrader(null, readOnly, []).pass);

// --- gradeCase aggregation ------------------------------------------------
const spec = {
  graders: [
    { name: 'a', type: 'regex', pattern: 'tier:\\s*fast' },
    { name: 'b', type: 'no_edits' },
  ],
};
c.ok('gradeCase: passes only when every grader passes',
  gradeCase(spec, parseStream(stream([text('tier: fast'), tool('Read', {})])), []).pass);
c.ok('gradeCase: SEEDED BROKEN — one failing grader fails the case',
  !gradeCase(spec, parseStream(stream([text('tier: fast'), tool('Edit', {})])), []).pass);
c.equal('gradeCase: reports every grader result',
  gradeCase(spec, parseStream(stream([text('tier: fast')])), []).graders.length, 2);
c.ok('gradeCase: a case with NO graders cannot pass vacuously',
  !gradeCase({ graders: [] }, parseStream(stream([text('anything')])), []).pass);

c.finish();
