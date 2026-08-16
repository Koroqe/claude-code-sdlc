'use strict';

const ledger = require('./ledger-client');

// Shape (a): empty catch block. No data mutation anywhere in this function --
// it only reads and computes -- but the result feeds a downstream charge
// decision, so the "financial" half of FR-7.2's disjunction applies on its
// own -> CRITICAL, independent of the mutation half.
async function computeOutstandingBalance(accountId) {
  let balance = 0;
  try {
    const entries = await ledger.fetchEntries(accountId);
    balance = entries.reduce((sum, e) => sum + e.amount, 0);
  } catch {}
  return balance;
}

module.exports = { computeOutstandingBalance };
