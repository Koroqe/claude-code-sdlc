'use strict';

const db = require('./db');

function getInvoice(id) {
  return db.invoices.find((i) => i.id === id) || null;
}

function updateInvoice(id, options) {
  const invoice = getInvoice(id);
  invoice.lastEditedBy = options.userId;
  return db.invoices.save(invoice);
}

module.exports = { getInvoice, updateInvoice };
