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

// opts is an options object, never further positionals: { agent_type, session_id,
// agentIdOverride }. agentIdOverride injects a RAW payload agent_id (e.g. the
// number 42) that the positional string parameter cannot express.
function record(transcript, agentId, cwd, opts) {
  const o = opts || {};
  const hasOwn = Object.prototype.hasOwnProperty;
  const input = {
    hook_event_name: 'SubagentStop',
    cwd,
    agent_id: hasOwn.call(o, 'agentIdOverride') ? o.agentIdOverride : agentId,
    agent_transcript_path: transcript === null ? undefined : path.join(TRANSCRIPTS, transcript),
  };
  if (hasOwn.call(o, 'agent_type')) input.agent_type = o.agent_type;
  if (hasOwn.call(o, 'session_id')) input.session_id = o.session_id;
  return runHook('subagent:stop:wave-record', input, { SDLC_HOOK_HANDLERS_DIR: HANDLERS });
}
function readRecord(cwd, id) {
  return JSON.parse(rawRecord(cwd, id));
}
function rawRecord(cwd, id) {
  return fs.readFileSync(path.join(cwd, '.claude', 'debug', 'wave-results', id + '.json'), 'utf8');
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

// 7. TC-B1 / TC-B13(a): bound-passing agent_type and session_id are recorded
//    verbatim, and every pre-existing field keeps the exact shape of a
//    no-field record.
{
  const dir = tempDir('sdlc-wave-');
  const sid = '81ea7ae9-1111-4222-8333-abcdefabcdef';
  const r = record('subagent-verify-pass.jsonl', 'agent-7a', dir, {
    agent_type: 'code-reviewer',
    session_id: sid,
  });
  c.equal('exits 0 with agent_type and session_id present', r.code, 0);
  const withFields = readRecord(dir, 'agent-7a');
  c.equal('agent_type is recorded verbatim', withFields.agent_type, 'code-reviewer');
  c.equal('session_id is recorded verbatim', withFields.session_id, sid);
  c.ok('body agent_id passes the field bound',
    /^[A-Za-z0-9:_-]{1,64}$/.test(withFields.agent_id));

  record('subagent-verify-pass.jsonl', 'agent-7b', dir);
  const without = readRecord(dir, 'agent-7b');
  for (const k of ['commands', 'files_written', 'tool_counts', 'tool_results', 'tool_results_errored', 'final_text']) {
    c.ok('pre-existing field ' + k + ' is shape-identical to a no-field record',
      JSON.stringify(withFields[k]) === JSON.stringify(without[k]));
  }
  rimraf(dir);
}

// 8. TC-B3: agent_type absent (older CLI) — the raw written bytes carry no
//    "agent_type" key at all: omitted, never null. Same for session_id.
{
  const dir = tempDir('sdlc-wave-');
  const r = record('subagent-verify-pass.jsonl', 'agent-8', dir);
  c.equal('exits 0 without agent_type', r.code, 0);
  const raw = rawRecord(dir, 'agent-8');
  c.ok('raw JSON has no "agent_type" substring when the payload had none',
    raw.indexOf('agent_type') === -1);
  c.ok('raw JSON has no "session_id" substring when the payload had none',
    raw.indexOf('session_id') === -1);
  rimraf(dir);
}

// 9. TC-B4: a pre-existing on-disk record is never migrated or rewritten when
//    an unrelated record lands in the same directory.
{
  const dir = tempDir('sdlc-wave-');
  const inside = path.join(dir, '.claude', 'debug', 'wave-results');
  fs.mkdirSync(inside, { recursive: true });
  const prior = path.join(inside, 'old-agent.json');
  fs.writeFileSync(prior, '{"agent_id":"old-agent","final_text":"legacy record"}\n');
  const past = new Date(Date.now() - 86400000);
  fs.utimesSync(prior, past, past);
  const bytesBefore = fs.readFileSync(prior, 'utf8');
  const mtimeBefore = fs.statSync(prior).mtimeMs;
  record('subagent-verify-pass.jsonl', 'agent-9', dir, { agent_type: 'build-runner' });
  c.equal('pre-existing record bytes are untouched', fs.readFileSync(prior, 'utf8'), bytesBefore);
  c.equal('pre-existing record mtime is untouched', fs.statSync(prior).mtimeMs, mtimeBefore);
  rimraf(dir);
}

// 10. TC-B6: invalid transcript + agent_type present — the early return is
//     unaffected by the new field: exit 0, no record.
{
  const dir = tempDir('sdlc-wave-');
  const r = record('does-not-exist.jsonl', 'agent-10', dir, { agent_type: 'code-reviewer' });
  c.equal('exits 0 on a missing transcript even with agent_type present', r.code, 0);
  c.ok('writes no record on the early-return path',
    !fs.existsSync(path.join(dir, '.claude', 'debug', 'wave-results')));
  rimraf(dir);
}

// 11. TC-B7: the wave-results path is squatted by a FILE — caught, silent,
//     never blocks, squatter untouched.
{
  const dir = tempDir('sdlc-wave-');
  fs.mkdirSync(path.join(dir, '.claude', 'debug'), { recursive: true });
  const squatter = path.join(dir, '.claude', 'debug', 'wave-results');
  fs.writeFileSync(squatter, 'not a directory\n');
  const r = record('subagent-verify-pass.jsonl', 'agent-11', dir, { agent_type: 'verifier' });
  c.equal('exits 0 when wave-results is a file', r.code, 0);
  c.ok('never blocks on the unwritable path', !/"continue"\s*:\s*false/.test(r.stdout));
  c.equal('the squatting file is untouched', fs.readFileSync(squatter, 'utf8'), 'not a directory\n');
  rimraf(dir);
}

// 12. TC-B8: hostile/invalid agent_type variants (65 chars, backtick+newline,
//     number, array) — key OMITTED, never truncated or coerced.
{
  const dir = tempDir('sdlc-wave-');
  const variants = ['x'.repeat(65), 'tick`type\nnewline', 42, ['code-reviewer']];
  variants.forEach(function (v, i) {
    const id = 'agent-12-' + i;
    const r = record('subagent-verify-pass.jsonl', id, dir, { agent_type: v });
    c.equal('exits 0 for hostile agent_type variant ' + i, r.code, 0);
    c.ok('variant ' + i + ' leaves no "agent_type" substring in the raw JSON',
      rawRecord(dir, id).indexOf('agent_type') === -1);
  });
  rimraf(dir);
}

// 13. TC-B9: the record-body agent_id is bounded by the same regex but FALLS
//     BACK to safeId on failure — always present, never omitted. A bound-
//     passing colon-bearing id legitimately differs between body and filename
//     (safeId strips ':', the body bound admits it).
{
  const dir = tempDir('sdlc-wave-');
  record('subagent-verify-pass.jsonl', 'sdlc:agent-13', dir);
  const a = readRecord(dir, 'sdlcagent-13');
  c.equal('a bound-passing colon-bearing agent_id is recorded raw in the body',
    a.agent_id, 'sdlc:agent-13');
  record('subagent-verify-pass.jsonl', 'agent`#!@13', dir);
  const b = readRecord(dir, 'agent13');
  c.equal('a bound-failing agent_id falls back to safeId in the body', b.agent_id, 'agent13');
  c.ok('the agent_id key is always present', 'agent_id' in b);
  rimraf(dir);
}

// 14. TC-B10: traversal shapes in BOTH fields — one sanitised file inside
//     wave-results, nothing outside, hostile agent_type omitted.
{
  const dir = tempDir('sdlc-wave-');
  record('subagent-verify-pass.jsonl', '../../escaped', dir, { agent_type: '../../etc/passwd' });
  const inside = path.join(dir, '.claude', 'debug', 'wave-results');
  const files = fs.existsSync(inside) ? fs.readdirSync(inside) : [];
  c.ok('exactly one sanitised record with both fields traversal-shaped',
    files.length === 1 && files[0].indexOf('..') === -1 && files[0].indexOf('/') === -1);
  c.ok('nothing is written outside wave-results',
    !fs.existsSync(path.join(dir, 'escaped.json')));
  c.ok('the traversal-shaped agent_type is omitted',
    rawRecord(dir, files[0].replace(/\.json$/, '')).indexOf('agent_type') === -1);
  rimraf(dir);
}

// 15. TC-B11: agent_type "" fails the bound like any other failing value —
//     record written, key omitted, NO empty-string carve-out.
{
  const dir = tempDir('sdlc-wave-');
  const r = record('subagent-verify-pass.jsonl', 'agent-15', dir, { agent_type: '' });
  c.equal('exits 0 on an empty-string agent_type', r.code, 0);
  const raw = rawRecord(dir, 'agent-15');
  c.ok('the record is still written', raw.length > 0);
  c.ok('the empty string is omitted by the bound — no carve-out',
    raw.indexOf('agent_type') === -1);
  rimraf(dir);
}

// 16. TC-B12: two back-to-back records — two independent files, each with its
//     own agent_type/agent_id, neither overwriting the other.
{
  const dir = tempDir('sdlc-wave-');
  record('subagent-verify-pass.jsonl', 'agent-16a', dir, { agent_type: 'code-reviewer' });
  record('subagent-verify-fail.jsonl', 'agent-16b', dir, { agent_type: 'security-auditor' });
  const a = readRecord(dir, 'agent-16a');
  const b = readRecord(dir, 'agent-16b');
  c.equal('first record keeps its own agent_type', a.agent_type, 'code-reviewer');
  c.equal('first record keeps its own agent_id', a.agent_id, 'agent-16a');
  c.equal('second record keeps its own agent_type', b.agent_type, 'security-auditor');
  c.equal('second record keeps its own agent_id', b.agent_id, 'agent-16b');
  c.equal('first record kept its own summary', a.tool_results_errored, 0);
  c.equal('second record kept its own summary', b.tool_results_errored, 1);
  rimraf(dir);
}

// 17. TC-B13(b): hostile or non-string session_id — key omitted, record still
//     written, exit 0.
{
  const dir = tempDir('sdlc-wave-');
  const variants = { long: 'x'.repeat(65), markdown: 's\n[evil](x)', nonstring: 42, underscore: 'under_score' };
  Object.keys(variants).forEach(function (k) {
    const id = 'agent-17-' + k;
    const r = record('subagent-verify-pass.jsonl', id, dir, { session_id: variants[k] });
    c.equal('exits 0 for ' + k + ' session_id', r.code, 0);
    c.ok(k + ' session_id is omitted from the raw JSON',
      rawRecord(dir, id).indexOf('session_id') === -1);
  });
  rimraf(dir);
}

// 18. TC-B14: a NON-STRING agent_id (the number 42) must not throw into the
//     top-level catch and silently lose the record — it falls back to
//     'unknown' and the record IS written.
{
  const dir = tempDir('sdlc-wave-');
  const r = record('subagent-verify-pass.jsonl', 'ignored', dir, {
    agentIdOverride: 42,
    agent_type: 'code-reviewer',
  });
  c.equal('exits 0 on a non-string agent_id', r.code, 0);
  const rec = readRecord(dir, 'unknown');
  c.equal('the record lands at unknown.json with body agent_id unknown', rec.agent_id, 'unknown');
  c.equal('and the bound-passing agent_type is still recorded', rec.agent_type, 'code-reviewer');
  rimraf(dir);
}

c.finish();
