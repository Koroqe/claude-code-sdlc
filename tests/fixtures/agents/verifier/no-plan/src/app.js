'use strict';

const { greet } = require('./greeter.js');

/** Registers a route that uses greet(). Nothing declares this file as an expected artifact. */
function createApp(router) {
  router.get('/api/greet/:name', (req, res) => {
    res.json({ message: greet(req.params.name) });
  });
  return router;
}

module.exports = { createApp };
