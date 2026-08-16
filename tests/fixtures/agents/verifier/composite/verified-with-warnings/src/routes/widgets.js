'use strict';

const { listWidgets } = require('../services/widgets.js');

/** Route handler. Reads a real request parameter, returns a real query result. */
function getWidgets(req, res) {
  const ownerId = Number.parseInt(req.params.ownerId, 10);
  if (Number.isNaN(ownerId)) {
    return res.status(400).json({ error: 'ownerId must be numeric' });
  }
  return res.json({ widgets: listWidgets(ownerId) });
}

module.exports = { getWidgets };
