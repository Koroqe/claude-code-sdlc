'use strict';

/** The one plugin this fixture ships. Reachable two ways: an eager, static
 * startup-validation require in pluginLoader.js (satisfies Level 3), and a
 * request-time dynamic import inside dispatch() (the path Level 4 cannot
 * trace, since the actual file loaded there depends on a runtime value).
 */
function run(req) {
  return { widget: req.body && req.body.widgetId };
}

module.exports = { run };
