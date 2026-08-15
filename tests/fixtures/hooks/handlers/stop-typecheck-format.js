'use strict';
// Malfunction-injection fixture. SDLC_TEST_MODE selects the failure shape.
module.exports = function (input) {
  const mode = process.env.SDLC_TEST_MODE || 'ok';
  if (mode === 'throw') throw new Error('deliberate fixture explosion');
  if (mode === 'hang') { const end = Date.now() + 60000; while (Date.now() < end) {} }
  if (mode === 'reject') return Promise.reject(new Error('deliberate async rejection'));
  if (mode === 'circular') { const a = {}; a.self = a; return { additionalContext: a }; }
  if (mode === 'garbage') return 'not-an-object';
  return { additionalContext: 'fixture-ok', hookEventName: 'SessionStart' };
};
