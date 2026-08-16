'use strict';

const db = require('./db');

function findUserById(id) {
  return db.raw('SELECT * FROM users WHERE id = ?', [id]);
}

module.exports = { findUserById };
