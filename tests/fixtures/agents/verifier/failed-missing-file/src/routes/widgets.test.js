'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getWidgets } = require('./widgets.js');

/** Same test as exercised/ — Level 4 would be VERIFIED-worthy on its own. */
test('getWidgets returns both of owner 7\'s widgets', () => {
  const req = { params: { ownerId: '7' } };
  let statusCode = 200;
  let body;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  getWidgets(req, res);

  assert.equal(statusCode, 200);
  assert.deepEqual(body, {
    widgets: [
      { id: 1, name: 'sprocket' },
      { id: 2, name: 'flange' },
    ],
  });
});
