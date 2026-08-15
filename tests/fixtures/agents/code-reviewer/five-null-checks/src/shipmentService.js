'use strict';

const db = require('./db');

function getShipment(id) {
  return db.shipments.find((s) => s.id === id) || null;
}

function updateShipment(id, options) {
  const shipment = getShipment(id);
  shipment.lastEditedBy = options.userId;
  return db.shipments.save(shipment);
}

module.exports = { getShipment, updateShipment };
