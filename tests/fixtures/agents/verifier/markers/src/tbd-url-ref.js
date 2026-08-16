'use strict';

/**
 * TC-4.14: TBD with an issue/PR URL on the same line — expected: WARNING
 * (downgraded), Level 2 still PASSES.
 */
function computeBulkPricing(quantity) {
  // TBD https://github.com/org/repo/issues/42
  return quantity;
}

module.exports = { computeBulkPricing };
