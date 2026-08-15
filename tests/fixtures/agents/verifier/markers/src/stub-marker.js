'use strict';

/**
 * TC-4.7: literal token `stub` describing an incomplete function —
 * expected: BLOCKER (unconditional).
 */
function calculateShipping(order) {
  // stub: real carrier-rate lookup not wired in yet
  return 0;
}

module.exports = { calculateShipping };
