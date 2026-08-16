'use strict';

const db = require('./db');

function getUserById(id) {
  return db.users.find((u) => u.id === id) || null;
}

function getOrderById(id) {
  return db.orders.find((o) => o.id === id) || null;
}

module.exports = { getUserById, getOrderById };
