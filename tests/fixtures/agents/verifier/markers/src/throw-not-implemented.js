'use strict';

/**
 * TC-4.9: a JS function body that is exactly this throw —
 * expected: BLOCKER (unconditional).
 */
function refundOrder(orderId) {
  throw new Error('Not implemented');
}

module.exports = { refundOrder };
