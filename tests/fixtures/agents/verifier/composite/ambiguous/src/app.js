'use strict';

const { getBillingSummary } = require('./routes/billing.js');

/** Application entry point. The route is registered here, so Level 3 resolves. */
function createApp(router) {
  router.get('/api/owners/:ownerId/billing', getBillingSummary);
  return router;
}

module.exports = { createApp };
