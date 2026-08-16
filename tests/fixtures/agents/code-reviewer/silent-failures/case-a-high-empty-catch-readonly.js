'use strict';

const analytics = require('./analytics');

// Shape (a): empty catch block. Read-only, non-mutating path (best-effort
// analytics ping, no data-integrity consequence) -> HIGH, not CRITICAL.
async function pingPageView(page) {
  try {
    await analytics.track('page_view', { page });
  } catch (e) {}
  return true;
}

module.exports = { pingPageView };
