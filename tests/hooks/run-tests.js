#!/usr/bin/env node
'use strict';

/**
 * Zero-dependency runner for the hook tests.
 *
 * Each tests/hooks/test-*.js is executed as its own process and must exit 0.
 * Runs them all before reporting, so one failure does not hide the others.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const files = fs
  .readdirSync(DIR)
  .filter((n) => /^test-.*\.js$/.test(n))
  .sort();

if (files.length === 0) {
  process.stderr.write('FAIL: no test files matched tests/hooks/test-*.js — the runner found nothing to run\n');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(DIR, file)], { encoding: 'utf8' });
  process.stdout.write(result.stdout || '');
  if (result.status !== 0) {
    process.stderr.write(result.stderr || '');
    failed += 1;
  }
}

if (failed > 0) {
  process.stderr.write('\n' + failed + ' of ' + files.length + ' hook test file(s) failed\n');
  process.exit(1);
}
process.stdout.write('\nAll ' + files.length + ' hook test file(s) passed\n');
process.exit(0);
