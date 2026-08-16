// Fixture Express app for the plan-critic test fixtures. Registers the
// widgets router; the "Widget Status Badge" plan fixtures' Slice 1 confirms
// this registration already exists and needs no change.

const express = require('express');
const widgetsRouter = require('./routes/widgets');

const app = express();
app.use(widgetsRouter);

module.exports = app;
