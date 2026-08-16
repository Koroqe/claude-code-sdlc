'use strict';

/** Data layer. Returns rows for a real owner id — no hardcoded stand-in. */
const rows = [
  { id: 1, ownerId: 7, name: 'sprocket' },
  { id: 2, ownerId: 7, name: 'flange' },
  { id: 3, ownerId: 9, name: 'gasket' },
];

function findWidgetsByOwner(ownerId) {
  return rows.filter((r) => r.ownerId === ownerId);
}

module.exports = { findWidgetsByOwner };
