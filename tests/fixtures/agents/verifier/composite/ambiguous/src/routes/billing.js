'use strict';

const { summarizeBilling } = require('../services/billing.js');

/** Route handler. Reads a real request parameter and awaits a real service call. */
async function getBillingSummary(req, res) {
  const ownerId = Number.parseInt(req.params.ownerId, 10);
  if (Number.isNaN(ownerId)) {
    return res.status(400).json({ error: 'ownerId must be numeric' });
  }
  const summary = await summarizeBilling(ownerId);
  return res.json({ summary });
}

module.exports = { getBillingSummary };
