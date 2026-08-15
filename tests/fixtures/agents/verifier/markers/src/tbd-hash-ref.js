'use strict';

/**
 * TC-4.12: TBD with a bare `#<digits>` issue reference on the same line —
 * expected: WARNING (downgraded), Level 2 still PASSES.
 */
function computeLoyaltyPoints(order) {
  // TBD(#42)
  return order.total * 0;
}

module.exports = { computeLoyaltyPoints };
