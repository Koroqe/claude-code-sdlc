'use strict';

const db = require('./db');

function getNotification(id) {
  return db.notifications.find((n) => n.id === id) || null;
}

function updateNotification(id, options) {
  const notification = getNotification(id);
  notification.lastEditedBy = options.userId;
  return db.notifications.save(notification);
}

module.exports = { getNotification, updateNotification };
