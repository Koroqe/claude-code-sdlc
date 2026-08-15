'use strict';

const router = require('./admin-router');
const db = require('./db');
const { requireRole } = require('./middleware/require-role');

router.get('/admin/users', requireRole('admin'), (req, res) => {
  return res.json({ users: db.users.all() });
});

// requireRole reads req.user.role. req.user is populated by attachUser,
// which is registered globally elsewhere (not part of this diff) -- whether
// it runs before this route's requireRole check on every request path, and
// whether it rejects rather than defaults req.user when no valid session is
// present, is not visible from this file.
router.delete('/admin/users/:id', requireRole('admin'), (req, res) => {
  db.users.remove(req.params.id);
  return res.status(204).end();
});

module.exports = { router };
