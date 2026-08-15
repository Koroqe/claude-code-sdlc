'use strict';

const { createApp } = require('./app.js');

// A real bootstrap: createApp is genuinely invoked and the app started, so
// the route has an actual entrant. This fixture is not about a missing
// caller — only about the dynamic dispatch defeating Level 4's trace.
const router = { post() {}, get() {}, listen() {} };
createApp(router).listen(3000);
