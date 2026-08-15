'use strict';

/**
 * A production plugin module, unrelated to the widget-listing feature above.
 * Nothing statically imports or requires this file — it is reachable only
 * through the runtime-computed dynamic import in ../services/loader.js.
 */
function run(context) {
  return { report: `generated for ${context.owner}` };
}

module.exports = { run };
