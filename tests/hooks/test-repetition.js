#!/usr/bin/env node
'use strict';

/**
 * Unit tests for hooks/lib/repetition.js — the step-repetition detector.
 *
 * Step repetition is the largest single measured multi-agent failure mode
 * (17.14% of failures, MAST). The detector is advisory, so a bug here cannot
 * block a run — which is exactly why it needs tests: a silently broken
 * detector reports "no repetition" forever and nobody notices.
 *
 * Every assertion below is paired: the detector must FIRE on a real loop and
 * must STAY QUIET on honest iteration. A detector that only ever fires is as
 * useless as one that never does.
 */

const { analyse, signature, normalizeInput } = require('../../hooks/lib/repetition.js');
const { Checks } = require('./harness');

const c = new Checks('repetition detector');
const bash = (cmd) => ({ name: 'Bash', input: { command: cmd } });
const read = (p) => ({ name: 'Read', input: { file_path: p } });

// --- the loop it exists to catch ------------------------------------------
const loop = analyse([bash('npm test'), bash('npm test'), bash('npm test')]);
c.equal('fires on three identical calls', loop.maxRepeat, 3);
c.equal('counts the consecutive run', loop.longestRun, 3);
c.equal('collapses them to one distinct signature', loop.distinct, 1);
c.equal('names the repeated call', loop.repeated.length, 1);

// --- honest iteration must NOT look like a loop ----------------------------
const honest = analyse([read('a.js'), read('b.js'), read('c.js'), bash('npm test')]);
c.equal('SEEDED QUIET — four different calls report no repetition', honest.repeated.length, 0);
c.equal('distinct count is exact', honest.distinct, 4);
c.equal('longest run of distinct calls is 1', honest.longestRun, 1);

// --- interleaving: same call revisited later is weaker evidence than a run --
const interleaved = analyse([bash('ls'), read('a'), bash('ls'), read('b'), bash('ls')]);
c.equal('repeat count still accumulates across gaps', interleaved.maxRepeat, 3);
c.equal('but the consecutive run stays 1 — the sharper signal', interleaved.longestRun, 1);

// --- threshold behaviour ---------------------------------------------------
c.equal('two calls stay below the default minRepeat of 3',
  analyse([bash('x'), bash('x')]).repeated.length, 0);
c.equal('minRepeat is configurable downward',
  analyse([bash('x'), bash('x')], { minRepeat: 2 }).repeated.length, 1);

// --- normalisation: incidental differences must not hide a loop ------------
c.equal('temp paths normalise to a single signature',
  analyse([bash('cat /tmp/abc123/f'), bash('cat /tmp/zzz999/f')]).distinct, 1);
c.equal('hex ids normalise', normalizeInput({ id: 'deadbeef1234' }), '{"id":"<hex>"}');
c.equal('timestamps normalise', normalizeInput({ t: '2026-08-24T00:00:00Z' }), '{"t":"<ts>"}');
c.ok('whitespace is collapsed, so reflow is not a difference',
  normalizeInput({ c: 'a\n\n  b' }) === normalizeInput({ c: 'a b' }));

// --- normalisation must NOT be so aggressive it merges real differences ----
c.ok('SEEDED DISTINCT — different commands stay different',
  signature('Bash', { command: 'npm test' }) !== signature('Bash', { command: 'npm build' }));
c.ok('SEEDED DISTINCT — same input to different tools stays different',
  signature('Read', { file_path: 'a' }) !== signature('Write', { file_path: 'a' }));
c.ok('SEEDED DISTINCT — different files stay different',
  signature('Read', { file_path: 'a.js' }) !== signature('Read', { file_path: 'b.js' }));

// --- robustness: a detector that throws would cost the whole record --------
c.equal('empty input is not an error', analyse([]).longestRun, 0);
c.equal('null input is not an error', analyse(null).distinct, 0);
c.equal('junk entries are skipped, not fatal',
  analyse([null, 'nonsense', bash('x')]).distinct, 1);
const circular = { name: 'Bash', input: {} };
circular.input.self = circular.input;
c.equal('an unserialisable input degrades to an empty signature rather than throwing',
  analyse([circular]).distinct, 1);
c.ok('signature is bounded',
  signature('Bash', { command: 'x'.repeat(5000) }).length <= 320);

c.finish();
