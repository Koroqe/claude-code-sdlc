'use strict';
// Returns a result whose toString explodes. On the promise path this used to
// escape as an unhandled rejection and exit 1 — breaking the fail-open contract.
module.exports = function () {
  return Promise.resolve({
    systemMessage: { toString: function () { throw new Error('boom-from-tostring'); } },
  });
};
