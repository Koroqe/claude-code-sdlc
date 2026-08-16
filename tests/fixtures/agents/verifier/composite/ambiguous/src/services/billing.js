'use strict';

// billing-sdk is a real, declared production dependency — but its
// implementation is not part of this codebase (not vendored, no
// node_modules checked into this fixture). verifier has no source to read
// to determine whether fetchSummary() returns real, non-hardcoded data or
// an internal stub. That is the one link in this chain that is genuinely
// ambiguous under static analysis, not merely unresolved or missing.
const billingSdk = require('billing-sdk');

/** Passes the caller's real ownerId straight through to the SDK call. */
async function summarizeBilling(ownerId) {
  return billingSdk.fetchSummary(ownerId);
}

module.exports = { summarizeBilling };
