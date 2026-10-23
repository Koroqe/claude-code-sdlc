#!/usr/bin/env node
'use strict';

/**
 * Guards the shipped topic-closure rule (`src/rules/topic-closure.md`), which
 * the installer places in every adopter's ~/.claude/rules/ and which loads in
 * every session.
 *
 * Checks (tracer slice):
 *   FR-5.1  the rule file exists and is non-empty (an empty rule is exactly one
 *           problem, then the validator stops).
 *   FR-5.2  manifests/owned-files.txt lists `rules/topic-closure.md` under
 *           `owns` — not `legacy`, which would REMOVE it on install.
 *   FR-5.8(b) the rule carries no maintainer-environment literal. The shipped
 *           file is generic; those literals belong to the author's own setup.
 *           One problem per occurrence. (`/Users/` is left to
 *           validate-personal-paths.js.)
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const RULE = 'src/rules/topic-closure.md';
const MANIFEST = 'manifests/owned-files.txt';
const OWNED_ENTRY = 'rules/topic-closure.md';

const FORBIDDEN = [
  'this Mac',
  '~/Documents',
  'Projects.nosync',
  'Deliberately NOT listed',
  'delete this file',
  'output-shaping.md',
  'opos-precedence.md',
];

function tryRead(root, rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Entries of the manifest's `owns` section only. */
function ownsEntries(text) {
  const out = [];
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    if (line === 'owns' || line === 'legacy') { section = line; continue; }
    if (section === 'owns') out.push(line);
  }
  return out;
}

core.run('validate-topic-closure', (v, args) => {
  const root = args.root;
  const rule = tryRead(root, RULE);
  const manifest = tryRead(root, MANIFEST);

  const present = (rule !== null ? 1 : 0) + (manifest !== null ? 1 : 0);
  const missing = [RULE, MANIFEST].filter((rel, i) => (i === 0 ? rule : manifest) === null);
  const desc = 'topic-closure source files (' + RULE + ' and ' + MANIFEST + ')' +
    (missing.length ? ' — ' + missing.map((m) => 'missing: ' + m).join(', ') : '');
  const minimum = args.min === null ? 2 : args.min;
  if (!v.requireMinimum(present, minimum, desc)) return;

  if (rule !== null && rule.trim() === '') {
    v.error(RULE, 'FR-5.1: ' + RULE + ' is empty');
    return;
  }

  if (manifest !== null && ownsEntries(manifest).indexOf(OWNED_ENTRY) === -1) {
    v.error(MANIFEST, 'FR-5.2: ' + OWNED_ENTRY + ' is not listed under `owns` — the installer would never deliver it');
  }

  if (rule !== null) {
    for (const lit of FORBIDDEN) {
      let from = 0;
      for (;;) {
        const i = rule.indexOf(lit, from);
        if (i === -1) break;
        v.error(RULE, 'FR-5.8(b): forbidden literal "' + lit + '" in the shipped rule');
        from = i + lit.length;
      }
    }
  }

  process.stdout.write('validate-topic-closure: checked ' + present + ' file(s), ' +
    FORBIDDEN.length + ' forbidden literals\n');
});
