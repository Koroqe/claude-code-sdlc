'use strict';

// TC-4.16: negative case — an issue reference exists elsewhere in this file,
// but not on the marker's own line. The same-line requirement is literal:
// this must still be BLOCKER, with no downgrade.
function computeRefundWindow(order) {
  // TBD
  return 30;
}

// A long stretch of unrelated file separates the marker above from the
// issue reference below, to make clear the two are not adjacent.
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------

// tracked separately in #42 — unrelated to the TBD above, on a different line
module.exports = { computeRefundWindow };
