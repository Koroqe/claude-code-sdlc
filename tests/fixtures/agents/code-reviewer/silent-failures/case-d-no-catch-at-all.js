'use strict';

const settingsClient = require('./settings-client');

// Shape (d): a promise chain with no .catch()/try-catch at all around an
// operation that can reject. Read-only settings fetch, no mutation -> HIGH.
async function getCachedSettings(userId) {
  const settings = await settingsClient.fetch(userId);
  return settings;
}

module.exports = { getCachedSettings };
