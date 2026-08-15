'use strict';

const db = require('./db');

// Pre-existing CRITICAL issue: no auth middleware, no role check. Any caller
// can wipe the entire users table.
function deleteAllUsers(req, res) {
  db.users.deleteAll();
  return res.status(204).end();
}

function getOrderSummary(req, res) {
  const orderId = req.params.orderId;
  const order = db.orders.find((o) => o.id === orderId);
  return res.json({ order });
}

module.exports = { deleteAllUsers, getOrderSummary };
