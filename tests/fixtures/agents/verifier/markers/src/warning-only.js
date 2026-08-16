'use strict';

/**
 * TC-4.17: three WARNING-tier markers, no BLOCKER-tier token anywhere in
 * this file. Level 2 must still report PASS, and all three findings must
 * still be individually recorded in the report's `gaps` array at level 2.
 */
function renderOwnerCard(owner) {
  // TODO: add avatar once the design is finalized
  const name = owner.name; // HACK: falls back to email until name is required
  const bio = owner.bio || 'PLACEHOLDER bio';
  return { name, bio };
}

module.exports = { renderOwnerCard };
