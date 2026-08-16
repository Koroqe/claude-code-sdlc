'use strict';

const db = require('./db');
const logger = require('./logger');

// Shape (c): caught error whose only action is a logger call, with no
// rethrow, no propagation, no caller-visible signal. Data-mutation path
// (order status write) -> CRITICAL.
async function markOrderShipped(orderId) {
  try {
    await db.orders.update(orderId, { status: 'shipped' });
  } catch (e) {
    logger.error(e);
  }
}

module.exports = { markOrderShipped };
