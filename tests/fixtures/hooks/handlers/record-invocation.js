'use strict';
// Writes a marker file when actually executed. Distinguishes "suppressed" from
// "ran and returned nothing" — the two look identical in stdout.
const fs = require('fs');
module.exports = function () {
  const marker = process.env.SDLC_TEST_MARKER;
  if (marker) fs.appendFileSync(marker, 'invoked\n');
  return { additionalContext: 'ran' };
};
