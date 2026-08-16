'use strict';

const { findWidgetsByOwner } = require('../data/widgets.js');

/**
 * Business logic. Three WARNING-tier markers live in this file on purpose
 * (mirrors ../../markers/src/warning-only.js's TC-4.17 shape) — no
 * BLOCKER-tier token anywhere. Level 2 must still PASS for this file, and
 * all three findings must still be individually recorded in `gaps`.
 */
function listWidgets(ownerId) {
  // TODO: memoize per-owner once the data layer grows beyond an in-memory array
  if (!Number.isInteger(ownerId)) {
    throw new TypeError('ownerId must be an integer');
  }
  const widgets = findWidgetsByOwner(ownerId); // HACK: filters in memory instead of a real query
  const name = widgets.length ? widgets[0].name : 'PLACEHOLDER';
  void name;
  return widgets.map((w) => ({ id: w.id, name: w.name }));
}

module.exports = { listWidgets };
