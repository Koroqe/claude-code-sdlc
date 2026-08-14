#!/usr/bin/env node
'use strict';

/**
 * Fails when the harness disagrees with itself about its own version.
 *
 * This validator exists because the repo shipped for months with a README
 * badge reading 3.1.0 and an installer reading 2.1.0. Three sources must
 * agree exactly (FR-5.7):
 *
 *   README.md                  version badge
 *   install.sh                 VERSION="..."
 *   .claude-plugin/plugin.json version
 *
 * A source that is missing, empty, or in an unexpected format is a loud
 * failure, not a silent skip — a version check that quietly finds nothing to
 * compare is the failure mode this whole validator suite exists to prevent.
 */

const path = require('path');
const fs = require('fs');
const core = require('./lib/validate-core.js');

const SEMVER = /^\d+\.\d+\.\d+$/;

const SOURCES = [
  {
    label: 'README.md version badge',
    file: 'README.md',
    extract: (text) => {
      const m = /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-([^-]+)-/.exec(text);
      return m ? m[1] : null;
    },
  },
  {
    label: 'install.sh VERSION',
    file: 'install.sh',
    extract: (text) => {
      const m = /^VERSION="([^"]*)"/m.exec(text);
      return m ? m[1] : null;
    },
  },
  {
    label: '.claude-plugin/plugin.json version',
    file: '.claude-plugin/plugin.json',
    extract: (text) => {
      const parsed = JSON.parse(text);
      return typeof parsed.version === 'string' ? parsed.version : null;
    },
  },
];

core.run('validate-version-consistency', (v, args) => {
  const found = [];

  for (const source of SOURCES) {
    const full = path.join(args.root, source.file);
    if (!fs.existsSync(full)) {
      v.error(source.file, `missing — cannot verify ${source.label}`);
      continue;
    }

    let value;
    try {
      value = source.extract(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      v.error(source.file, `could not be parsed while reading ${source.label}: ${err.message}`);
      continue;
    }

    if (!value) {
      v.error(source.file, `${source.label} not found or empty — the expected format may have changed`);
      continue;
    }
    if (!SEMVER.test(value)) {
      v.error(source.file, `${source.label} is \`${value}\`, which is not a semantic version`);
      continue;
    }
    found.push({ label: source.label, file: source.file, value });
  }

  if (!v.requireMinimum(found.length, SOURCES.length, 'readable version sources')) {
    return;
  }

  const distinct = [...new Set(found.map((f) => f.value))];
  if (distinct.length > 1) {
    const detail = found.map((f) => `${f.file} = ${f.value}`).join(', ');
    v.error('(scope)', `version strings disagree: ${detail}`);
  }
});
