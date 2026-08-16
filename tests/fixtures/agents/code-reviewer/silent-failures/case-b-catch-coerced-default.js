'use strict';

const recommendations = require('./recommendations-client');

// Shape (b): .catch() coerces the rejection into a benign default, with no
// logging, rethrow, or user-facing signal. Read-only suggestion fetch, no
// data mutation and no financial impact -> HIGH.
function getRelatedProducts(productId) {
  return recommendations.fetchFor(productId).catch(() => []);
}

module.exports = { getRelatedProducts };
