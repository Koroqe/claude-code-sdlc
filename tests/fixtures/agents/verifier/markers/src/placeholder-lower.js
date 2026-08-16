'use strict';

/**
 * TC-4.6: placeholder (lowercase) — expected: WARNING (unconditional),
 * Level 2 still PASSES.
 */
function buildEmptyState(label) {
  // placeholder copy until content team supplies the real string
  return `No ${label} yet.`;
}

module.exports = { buildEmptyState };
