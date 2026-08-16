'use strict';

const config = require('../../config/pluginName.json');

/**
 * Loads the plugin named in config/pluginName.json at runtime and invokes it.
 * `computedPath` is built from a value verifier cannot know without running
 * the code — Level 3 cannot resolve which module this actually loads.
 */
async function loadConfiguredPlugin(context) {
  const computedPath = '../plugins/' + config.pluginName + '.js';
  const mod = await import(computedPath);
  return mod.run(context);
}

module.exports = { loadConfiguredPlugin };
