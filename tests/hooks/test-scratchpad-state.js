#!/usr/bin/env node
'use strict';

/**
 * hooks/lib/scratchpad-state.js — pure-function unit tests.
 *
 * `doneSliceCount` and `blockersPresent` are new here (extracted alongside
 * `extractState`, `readCapped` etc. from `session-start-spine.js`), used by
 * the run-to-completion continuation check. These are pure string -> value
 * functions with no process/env/exit semantics to verify, so — unlike every
 * other test in this directory — this one requires the module in-process
 * rather than spawning it as a hook. The harness's "never require a hook
 * in-process" rule is about the fail-open PROCESS contract; a plain lib
 * module carries no such contract.
 */

const { Checks } = require('./harness');
const scratchpadState = require('../../hooks/lib/scratchpad-state.js');

const c = new Checks('scratchpad-state');
const { doneSliceCount, blockersPresent, extractState, firstPendingSlice } = scratchpadState;

// --- doneSliceCount --------------------------------------------------------

c.equal('no slices at all: 0', doneSliceCount('## Feature: X\n## Branch: main\n## Status: idle\n'), 0);

c.equal('counts only [x] lines, not [ ] lines', doneSliceCount([
  '- [x] Slice 1: a',
  '- [ ] Slice 2: b',
  '- [x] Slice 3: c',
].join('\n')), 2);

c.equal('a [x] line below ## Archive does not count', doneSliceCount([
  '- [x] Slice 1: a',
  '## Archive',
  '- [x] Slice 2: b',
  '- [x] Slice 3: c',
].join('\n')), 1);

c.equal('tolerant of mixed-case [X]', doneSliceCount([
  '- [X] Slice 1: a',
  '- [x] Slice 2: b',
].join('\n')), 2);

// --- blockersPresent --------------------------------------------------------

c.equal('false with no ## Blockers section at all',
  blockersPresent('## Feature: X\n## Status: implementing slice 1/2\n'), false);

const noneMarkers = ['(none)', 'None', 'NONE', '- none', '- (NONE)', 'None.', 'N/A', 'n/a'];
for (const marker of noneMarkers) {
  c.equal('false for none-marker ' + JSON.stringify(marker), blockersPresent([
    '## Status: implementing slice 1/2',
    '',
    '## Blockers',
    marker,
    '',
  ].join('\n')), false);
}

c.equal('true for a real blocker line', blockersPresent([
  '## Status: implementing slice 1/2',
  '',
  '## Blockers',
  'Waiting on human approval for the schema migration.',
  '',
].join('\n')), true);

c.equal('a ## Blockers section after ## Archive does not count', blockersPresent([
  '## Status: implementing slice 1/2',
  '',
  '## Archive',
  '## Blockers',
  'A real blocker, but archived.',
  '',
].join('\n')), false);

c.equal('stops at the next ## heading — a blocker-shaped line under a later section does not count',
  blockersPresent([
    '## Status: implementing slice 1/2',
    '',
    '## Blockers',
    '(none)',
    '',
    '## Completed',
    'Waiting on human approval for something unrelated.',
    '',
  ].join('\n')), false);

// --- extractState: 'paused' -------------------------------------------------

const pausedState = extractState('## Feature: X\n## Branch: main\n## Status: paused\n');
c.equal('a scratchpad with ## Status: paused yields status paused', pausedState.status, 'paused');

// --- firstPendingSlice -----------------------------------------------------
const NL = String.fromCharCode(10);
c.ok('firstPendingSlice: first unchecked slice', firstPendingSlice(['- [x] Slice 1: a', '- [ ] Slice 2: b', '- [ ] Slice 3: c'].join(NL)) === 2);
c.ok('firstPendingSlice: skips FAILED', firstPendingSlice(['- [ ] Slice 2: b FAILED', '- [ ] Slice 3: c'].join(NL)) === 3);
c.ok('firstPendingSlice: word-bounded (UNFAILEDX is not FAILED)', firstPendingSlice(['- [ ] Slice 2: UNFAILEDX', '- [ ] Slice 3: c'].join(NL)) === 2);
c.ok('firstPendingSlice: only FAILED left -> undefined', firstPendingSlice(['- [x] Slice 1: a', '- [ ] Slice 2: b FAILED'].join(NL)) === undefined);
c.ok('firstPendingSlice: ignores archive', firstPendingSlice(['- [x] Slice 1: a', '## Archive', '- [ ] Slice 9: z'].join(NL)) === undefined);

c.finish();
