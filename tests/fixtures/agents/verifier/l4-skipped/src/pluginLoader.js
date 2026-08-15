'use strict';

// Eager, static, fully-resolvable require — used only to validate at process
// startup that the built-in plugin exists. This is what makes Level 3 PASS:
// a real, literal-path import statement referencing widgetPlugin.js exists.
require('./plugins/widgetPlugin.js');

/**
 * Dispatches to the plugin named by `name` at request time. `name` is caller
 * data (the route's `:name` param), so the import target is only known once
 * a request actually arrives — Level 4 cannot name which file this loads
 * without running the code.
 */
async function dispatch(name, req) {
  const mod = await import('./plugins/' + name + '.js');
  return mod.run(req);
}

module.exports = { dispatch };
