'use strict';

function formatHeader(orderId) {
  return `Order #${orderId}`;
}

function formatLegacyReceipt(total) {
  // Pre-existing MEDIUM issue: naive string truncation instead of rounding.
  // Misformats values like 9.995 -> "9.99" instead of "10.00" (should round).
  const totalStr = String(total);
  return totalStr.slice(0, totalStr.indexOf('.') + 3);
}

function formatOrderSummary(orderId, total, currency) {
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${formatHeader(orderId)}: ${symbol}${formatLegacyReceipt(total)}`;
}

module.exports = { formatHeader, formatLegacyReceipt, formatOrderSummary };
