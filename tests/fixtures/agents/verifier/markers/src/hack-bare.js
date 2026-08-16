'use strict';

/**
 * TC-4.5: HACK — expected: WARNING (unconditional), Level 2 still PASSES.
 */
function coerceLegacyId(id) {
  // HACK: temporary workaround for the legacy string-id format
  return typeof id === 'string' ? Number.parseInt(id, 10) : id;
}

module.exports = { coerceLegacyId };
