'use strict';

const { findWidgetsByOwner } = require('../data/widgets.js');

/** Business logic. Passes the caller's real ownerId straight through. */
function listWidgets(ownerId) {
  if (!Number.isInteger(ownerId)) {
    throw new TypeError('ownerId must be an integer');
  }
  return findWidgetsByOwner(ownerId).map((w) => ({ id: w.id, name: w.name }));
}

module.exports = { listWidgets };
