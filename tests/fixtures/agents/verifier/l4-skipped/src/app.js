'use strict';

const { dispatch } = require('./pluginLoader.js');

/** Application entry point. The dispatch route is registered here. */
function createApp(router) {
  router.post('/api/plugins/:name/run', async (req, res) => {
    const result = await dispatch(req.params.name, req);
    res.json(result);
  });
  return router;
}

module.exports = { createApp };
