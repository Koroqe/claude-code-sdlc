'use strict';

const { getWidgets } = require('./routes/widgets.js');

/** Application entry point. The route is registered here, so Level 3 resolves. */
function createApp(router) {
  router.get('/api/owners/:ownerId/widgets', getWidgets);
  return router;
}

module.exports = { createApp };
