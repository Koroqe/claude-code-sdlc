'use strict';

const db = require('./db');

// Shape (a): empty catch block. Data-mutation path (widget update) -> CRITICAL.
async function updateWidget(req, res) {
  const { id } = req.params;
  const payload = req.body;
  try {
    await db.widgets.update(id, payload);
  } catch {}
  return res.status(204).end();
}

module.exports = { updateWidget };
