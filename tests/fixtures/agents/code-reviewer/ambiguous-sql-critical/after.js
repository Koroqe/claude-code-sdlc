'use strict';

const db = require('./db');
const { buildQuery } = require('./query-builder');

function findUserById(id) {
  return db.raw('SELECT * FROM users WHERE id = ?', [id]);
}

function findUsersByStatus(status) {
  const query = buildQuery(`SELECT * FROM users WHERE status = '${status}'`);
  return db.raw(query);
}

module.exports = { findUserById, findUsersByStatus };
