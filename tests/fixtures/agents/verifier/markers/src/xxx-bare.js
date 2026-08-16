'use strict';

// TC-4.3: bare XXX, no issue reference on this line — expected: BLOCKER.
function roundCurrency(amount) {
  // XXX
  return Math.round(amount * 100) / 100;
}

module.exports = { roundCurrency };
