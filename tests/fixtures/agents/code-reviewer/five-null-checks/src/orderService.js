'use strict';

const db = require('./db');

function getOrder(id) {
  return db.orders.find((o) => o.id === id) || null;
}

function updateOrder(id, options) {
  const order = getOrder(id);
  order.lastEditedBy = options.userId;
  return db.orders.save(order);
}

module.exports = { getOrder, updateOrder };
