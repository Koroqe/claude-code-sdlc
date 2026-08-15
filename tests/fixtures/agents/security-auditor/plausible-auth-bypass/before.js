'use strict';

const router = require('./admin-router');
const db = require('./db');
const { requireRole } = require('./middleware/require-role');

router.get('/admin/users', requireRole('admin'), (req, res) => {
  return res.json({ users: db.users.all() });
});

module.exports = { router };
