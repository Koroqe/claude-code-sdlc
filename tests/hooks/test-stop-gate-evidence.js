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

// --- advisory attribution (FR-5) -----------------------------------------
//
// Everything below asserts the advisory systemMessage built from same-session
// wave-records. The blocking decision itself must be byte-identical to the
// cases above (TC-C12: the pre-existing assertions run unmodified).
//
// Each case gets its OWN tempDir cwd: stop() above points cwd at the shared
// scratch, so seeding wave-records there would contaminate the pre-existing
// cases. stopIn/seedWaveResults exist for exactly that isolation.

const caseDirs = [];

function caseDir() {
  const dir = tempDir('sdlc-gate-evidence-case-');
  caseDirs.push(dir);
  return dir;
}

/**
 * Like stop(), but against an explicit per-case cwd. opts.session overrides
 * the Stop payload's session_id ('s1' by default); opts.session === null
 * omits the key entirely (the M1 precondition case). opts.env as in stop().
 */
function stopIn(cwd, file, opts) {
  const o = opts || {};
  const payload = { session_id: 's1', cwd, hook_event_name: 'Stop', transcript_path: file };
  if (o.session === null) delete payload.session_id;
  else if (o.session !== undefined) payload.session_id = o.session;
  return runHook(
    'stop:gate-evidence',
    payload,
    Object.assign({ SDLC_HOOK_HANDLERS_DIR: HANDLERS }, o.env || {})
  );
}

/**
 * Seed <cwd>/.claude/debug/wave-results. `records` maps filename stem to a
 * record body (object, serialized; or a raw string for malformed fixtures).
 */
function seedWaveResults(cwd, records) {
  const dir = path.join(cwd, '.claude', 'debug', 'wave-results');
  fs.mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(records)) {
    const body = records[name];
    fs.writeFileSync(
      path.join(dir, name + '.json'),
      typeof body === 'string' ? body : JSON.stringify(body, null, 2) + '\n'
    );
  }
  return dir;
}

/**
 * A wave-record body. rec(undefined) carries NO agent_type key; an extra of
 * { session_id: undefined } serializes with NO session_id key (JSON.stringify
 * drops undefined values).
 */
function rec(type, extra) {
  return Object.assign(
    type === undefined ? {} : { agent_type: type },
    { agent_id: 'a-' + (type || 'none'), session_id: 's1', recorded_at: '2026-08-20T10:00:00Z' },
    extra || {}
  );
}

const sysmsg = (r) => (r.json && r.json.systemMessage) || '';
const observedSide = (r) => {
  const m = sysmsg(r);
  const cut = m.indexOf(' — no same-session');
  return cut === -1 ? m : m.slice(0, cut);
};

const verdictWithSubagent = () => transcript([
  { text: 'Dispatching the gate agents.' },
  { sidechain: true, text: 'gate work' },
  { text: 'All nine gates pass. MERGE READY.' },
]);
const verdictNoSubagent = () => transcript([
  { text: 'All nine gates pass. MERGE READY.' },
]);

const FULL = () => ({
  'code-reviewer': rec('code-reviewer'),
  'security-auditor': rec('security-auditor'),
  'build-runner': rec('build-runner'),
  'verifier': rec('verifier'),
  'design-reviewer': rec('design-reviewer'),
});

// TC-C1: all five allowlist records, each carrying the Stop payload's session.
let d = caseDir();
seedWaveResults(d, FULL());
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C1: allowed with all five records seeded', !blocked(r), reason(r));
c.contains('TC-C1: names all five observed', sysmsg(r),
  'observed: code-reviewer, security-auditor, build-runner, verifier, design-reviewer');
c.contains('TC-C1: states it is advisory', sysmsg(r), 'advisory');
c.contains('TC-C1: not-observed side is none', sysmsg(r), 'no same-session wave-record found for: none');

// TC-C2: partial records — both sides named, decision unchanged.
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer'), 'build-runner': rec('build-runner') });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C2: partial records still allowed', !blocked(r), reason(r));
c.contains('TC-C2: observed side names the two recorded', sysmsg(r), 'observed: code-reviewer, build-runner');
c.contains('TC-C2: not-observed side names the gap', sysmsg(r),
  'no same-session wave-record found for: security-auditor, verifier, design-reviewer');

// TC-C3 / TC-C10: records with NO agent_type key — graceful degradation.
d = caseDir();
seedWaveResults(d, { one: rec(undefined), two: rec(undefined) });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C3: typeless records never change the allow outcome', !blocked(r), reason(r));
c.contains('TC-C3: observed side is none', sysmsg(r), 'observed: none');
c.contains('TC-C3: all five fall to not-observed', sysmsg(r),
  'no same-session wave-record found for: code-reviewer, security-auditor, build-runner, verifier, design-reviewer');

// TC-C4: no verdict claimed — no enrichment, no systemMessage, records or not.
d = caseDir();
seedWaveResults(d, FULL());
r = stopIn(d, transcript([{ text: 'The pipeline finishes by reporting a verdict.' }]));
c.ok('TC-C4: no verdict means no systemMessage', !blocked(r) && !sysmsg(r), sysmsg(r));

// TC-C5: absent / malformed / non-directory wave-results — never throws.
r = stopIn(caseDir(), verdictWithSubagent());
c.ok('TC-C5: absent wave-results dir still allows', !blocked(r), reason(r));
c.ok('TC-C5: absent wave-results dir exits 0', r.code === 0, 'exit ' + r.code);
c.ok('TC-C5: absent dir produces no systemMessage', !sysmsg(r), sysmsg(r));

d = caseDir();
seedWaveResults(d, { broken: 'this is {{{ not json', 'code-reviewer': rec('code-reviewer') });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C5: malformed record is skipped, not fatal', !blocked(r) && r.code === 0, reason(r));
c.contains('TC-C5: valid sibling of a malformed record still observed', sysmsg(r), 'observed: code-reviewer');

d = caseDir();
fs.mkdirSync(path.join(d, '.claude', 'debug'), { recursive: true });
fs.writeFileSync(path.join(d, '.claude', 'debug', 'wave-results'), 'a file, not a directory');
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C5: wave-results as a file allows without a message', !blocked(r) && !sysmsg(r) && r.code === 0,
  'exit ' + r.code + ' msg ' + sysmsg(r));

// TC-C7: zero subagents + verdict STILL BLOCKS — empty, partial, full records.
d = caseDir();
seedWaveResults(d, {});
const b1 = stopIn(d, verdictNoSubagent());
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer'), 'build-runner': rec('build-runner') });
const b2 = stopIn(d, verdictNoSubagent());
d = caseDir();
seedWaveResults(d, FULL());
const b3 = stopIn(d, verdictNoSubagent());
c.ok('TC-C7: blocks with empty wave-results', blocked(b1), reason(b1));
c.ok('TC-C7: blocks with partial wave-results', blocked(b2), reason(b2));
c.ok('TC-C7: blocks with full wave-results', blocked(b3), reason(b3));
c.ok('TC-C7: deny reason identical across all three variants',
  reason(b1) === reason(b2) && reason(b2) === reason(b3), reason(b3));
c.ok('TC-C7: pre-fix reason text preserved', /run the gates/i.test(reason(b1)), reason(b1));
c.ok('TC-C7: no systemMessage rides the deny', !sysmsg(b1) && !sysmsg(b2) && !sysmsg(b3),
  sysmsg(b1) + sysmsg(b2) + sysmsg(b3));

// TC-C8: the escape short-circuits before any enrichment.
d = caseDir();
seedWaveResults(d, FULL());
r = stopIn(d, verdictNoSubagent(), { env: { SDLC_ALLOW_UNEVIDENCED_GATES: '1' } });
c.ok('TC-C8: escape allows with no systemMessage', !blocked(r) && !sysmsg(r), sysmsg(r));

// TC-C9: out-of-vocabulary agent_type contributes to NEITHER side.
d = caseDir();
seedWaveResults(d, { gp: rec('general-purpose') });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C9: out-of-vocabulary type still allowed', !blocked(r), reason(r));
c.ok('TC-C9: "general-purpose" appears nowhere in the output',
  r.stdout.indexOf('general-purpose') === -1, r.stdout.slice(0, 300));
c.contains('TC-C9: observed side is none', sysmsg(r), 'observed: none');

// TC-C11: duplicate records for one agent_type — named exactly once.
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer'), 'code-reviewer-retry': rec('code-reviewer') });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C11: duplicated type named exactly once',
  sysmsg(r).split('code-reviewer').length - 1 === 1, sysmsg(r));

// M8: at most one leading plugin prefix is stripped before strict equality.
d = caseDir();
seedWaveResults(d, { p1: rec('sdlc:code-reviewer'), p2: rec('x:y:verifier') });
r = stopIn(d, verdictWithSubagent());
c.contains('M8: one plugin prefix stripped, literal matched', sysmsg(r), 'observed: code-reviewer');
c.contains('M8: double-prefixed name matches nothing', sysmsg(r),
  'no same-session wave-record found for: security-auditor, build-runner, verifier, design-reviewer');

// TC-C13 (M4): more than 64 entries — enrichment skipped ENTIRELY, no message.
d = caseDir();
const many = {};
for (let i = 0; i < 70; i += 1) many['r' + i] = rec('code-reviewer');
seedWaveResults(d, many);
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C13: 70 entries never throws or blocks', !blocked(r) && r.code === 0, 'exit ' + r.code);
c.ok('TC-C13: over-limit directory yields NO systemMessage', !sysmsg(r), sysmsg(r));

// TC-C13 (M3): an oversized record is stat-gated out, siblings survive.
d = caseDir();
seedWaveResults(d, {
  'code-reviewer': rec('code-reviewer'),
  'security-auditor': rec('security-auditor', { pad: 'x'.repeat(70000) }),
});
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C13: oversized record never throws', !blocked(r) && r.code === 0, 'exit ' + r.code);
c.contains('TC-C13: oversized record skipped, sibling observed', sysmsg(r), 'observed: code-reviewer —');
c.contains('TC-C13: oversized record falls to not-observed', sysmsg(r), 'security-auditor');

// TC-C14: hostile record content never reaches any output.
const hostile = ('# ZZHOSTILEZZ `rm -rf` **[click](x)**\n').repeat(150);
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer', { agent_id: hostile }) });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C14: hostile agent_id never appears in output',
  r.stdout.indexOf('ZZHOSTILEZZ') === -1, r.stdout.slice(0, 300));
c.contains('TC-C14: only the fixed allowlist name appears', sysmsg(r), 'observed: code-reviewer');

// TC-C15: a symlinked record file is refused via the handler's own lstat.
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer') });
const linkTarget = path.join(d, 'outside-target.json');
fs.writeFileSync(linkTarget, JSON.stringify(rec('build-runner')) + '\n');
fs.symlinkSync(linkTarget, path.join(d, '.claude', 'debug', 'wave-results', 'build-runner.json'));
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C15: symlinked record never throws', !blocked(r) && r.code === 0, 'exit ' + r.code);
c.contains('TC-C15: symlink target is never read', sysmsg(r), 'observed: code-reviewer —');
c.contains('TC-C15: symlinked type stays not-observed', sysmsg(r), 'build-runner');

// TC-C16: unrecognized record fields never appear in emitted text.
d = caseDir();
const extras = FULL();
for (const k of Object.keys(extras)) extras[k].notes = 'should never appear';
seedWaveResults(d, extras);
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C16: extra record fields never leak',
  r.stdout.indexOf('should never appear') === -1, r.stdout.slice(0, 300));

// TC-C17: cross-session record — excluded from attribution entirely.
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer', { session_id: 's-other' }) });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C17: cross-session record never reaches the observed side',
  observedSide(r).indexOf('code-reviewer') === -1, sysmsg(r));
c.contains('TC-C17: output identical to a zero-same-session scan', sysmsg(r),
  'observed: none — no same-session wave-record found for: code-reviewer, security-auditor, build-runner, verifier, design-reviewer');

// TC-C18: record with NO session_id — never admitted (undefined === undefined
// must not match), not-observed side is the full allowlist complement.
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer', { session_id: undefined }) });
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C18: sessionless record never observed',
  observedSide(r).indexOf('code-reviewer') === -1, sysmsg(r));
c.contains('TC-C18: all five named not-observed', sysmsg(r),
  'no same-session wave-record found for: code-reviewer, security-auditor, build-runner, verifier, design-reviewer');

// TC-C19: records exist but none share the Stop payload's session.
d = caseDir();
const stale = FULL();
for (const k of Object.keys(stale)) stale[k].session_id = 's-other';
seedWaveResults(d, stale);
r = stopIn(d, verdictWithSubagent());
c.ok('TC-C19: stale-session records still allow', !blocked(r), reason(r));
c.contains('TC-C19: observed side is none', sysmsg(r), 'observed: none');
c.contains('TC-C19: all five named not-observed', sysmsg(r),
  'no same-session wave-record found for: code-reviewer, security-auditor, build-runner, verifier, design-reviewer');

// M1: Stop payload WITHOUT session_id — enrichment skipped entirely, even
// when a sessionless record sits there (undefined === undefined never admits).
d = caseDir();
seedWaveResults(d, { 'code-reviewer': rec('code-reviewer', { session_id: undefined }) });
r = stopIn(d, verdictWithSubagent(), { session: null });
c.ok('M1: payload without session_id yields no message at all',
  !blocked(r) && !sysmsg(r) && r.code === 0, 'exit ' + r.code + ' msg ' + sysmsg(r));

for (const dir of caseDirs) rimraf(dir);
rimraf(scratch);
c.finish();
