'use strict';

const db = require('./db');

function getRefund(id) {
  return db.refunds.find((r) => r.id === id) || null;
}

function updateRefund(id, options) {
  const refund = getRefund(id);
  refund.lastEditedBy = options.userId;
  return db.refunds.save(refund);
}

module.exports = { getRefund, updateRefund };
