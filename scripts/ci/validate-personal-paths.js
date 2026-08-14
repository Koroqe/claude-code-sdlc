#!/usr/bin/env node
'use strict';

/**
 * Fails when a machine-specific absolute path leaks into a shipped asset.
 *
 * This harness is installed on other people's machines. A home-directory
 * absolute path baked into an agent prompt or the installer is broken for
 * every adopter, and it leaks the author's directory layout.
 *
 * Scope is the SHIPPED surface only (FR-5.5). `docs/`, `.claude/` and
 * `tests/fixtures/` are excluded: documentation legitimately quotes real
 * paths from a development machine, and the fixtures deliberately contain a
 * leak so this validator can be proven to fail.
 */

const path = require('path');
const fs = require('fs');
const core = require('./lib/validate-core.js');

const MIN_FILES = 20;

/** Shipped directories and files, relative to the scan root. */
const SHIPPED_DIRS = ['agents', 'skills', 'src', 'templates', 'scripts', '.claude-plugin'];
const SHIPPED_FILES = ['install.sh', 'README.md', 'CONTRIBUTING.md'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'fixtures'];

/** Home-directory absolute paths for macOS, Linux and Windows profiles. */
const PERSONAL_PATH_PATTERNS = [
  { re: /\/Users\/[A-Za-z0-9._-]+\//g, label: 'macOS home directory path' },
  { re: /\/home\/[A-Za-z0-9._-]+\//g, label: 'Linux home directory path' },
  { re: /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\/g, label: 'Windows profile path' },
];

/**
 * Documented placeholders that are intentional and portable. Kept
 * deliberately narrow — this is an allowlist of generic examples, not an
 * escape hatch for real paths.
 */
const ALLOWED_PLACEHOLDERS = [
  '/Users/you/',
  '/Users/username/',
  '/Users/<user>/',
  '/home/you/',
  '/home/username/',
  '/home/<user>/',
];

core.run('validate-personal-paths', (v, args) => {
  const files = [];

  for (const dir of SHIPPED_DIRS) {
    files.push(...core.walkFiles(path.join(args.root, dir), {
      excludeDirs: EXCLUDE_DIRS,
      test: (name) => /\.(md|js|json|sh|ya?ml|txt)$/.test(name),
    }));
  }
  for (const file of SHIPPED_FILES) {
    const full = path.join(args.root, file);
    if (fs.existsSync(full)) files.push(full);
  }

  const minimum = args.min === null ? MIN_FILES : args.min;
  if (!v.requireMinimum(files.length, minimum, 'shipped files to scan for personal paths')) {
    return;
  }

  for (const file of files) {
    const rel = path.relative(args.root, file);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const { re, label } of PERSONAL_PATH_PATTERNS) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(line)) !== null) {
          if (ALLOWED_PLACEHOLDERS.some((p) => match[0].startsWith(p))) continue;
          v.error(rel, `line ${index + 1}: ${label} \`${match[0]}\` must not ship — use a placeholder or resolve it at runtime`);
        }
      }
    });
  }
});
