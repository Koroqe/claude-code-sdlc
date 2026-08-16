'use strict';

// Internal admin listener. Bound to 127.0.0.1 only in ./bootstrap.js (not
// modified by this diff) -- unreachable from outside this host.
const router = require('./internal-router');

module.exports = { router };
