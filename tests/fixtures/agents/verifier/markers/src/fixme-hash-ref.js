'use strict';

/**
 * TC-4.15: FIXME with a bare `#<digits>` issue reference on the same line —
 * confirms the same downgrade mechanism applies to FIXME, not only TBD.
 * Expected: WARNING (downgraded), Level 2 still PASSES.
 */
function retryFailedPayment(paymentId) {
  // FIXME(#7)
  return false;
}

module.exports = { retryFailedPayment };
