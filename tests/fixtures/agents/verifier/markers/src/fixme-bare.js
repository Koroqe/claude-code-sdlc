'use strict';

// TC-4.2: bare FIXME, no issue reference on this line — expected: BLOCKER.
function normalizePhone(number) {
  // FIXME
  return number.replace(/\D/g, '');
}

module.exports = { normalizePhone };
