'use strict';

/**
 * TC-4.4: bare TODO on an otherwise-complete function — expected: WARNING
 * (unconditional), Level 2 still PASSES.
 */
function formatOwnerName(owner) {
  // TODO: consider caching in future
  return `${owner.firstName} ${owner.lastName}`.trim();
}

module.exports = { formatOwnerName };
