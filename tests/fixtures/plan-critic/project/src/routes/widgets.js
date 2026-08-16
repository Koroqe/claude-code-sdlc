// Fixture route handler for the plan-critic test fixtures. Represents the
// pre-existing state the "Widget Status Badge" plan fixtures start from: the
// route is already authenticated and already registered; it does not yet
// include `status` in its response (that is what Slice 1 of the plan adds).

const express = require('express');
const { listWidgets } = require('../data/widgets');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.headers.authorization) return res.sendStatus(401);
  return next();
}

router.get('/api/widgets', requireAuth, async (req, res) => {
  const widgets = await listWidgets();
  res.json(widgets.map((w) => ({ id: w.id, name: w.name })));
});

module.exports = router;
