#!/usr/bin/env node
'use strict';

/**
 * Fails when a prompt file contains invisible or deceptive Unicode.
 *
 * Every file scanned here is fed to a language model as instructions. A
 * zero-width character, a bidirectional override, a Unicode tag-block
 * sequence, or a Cyrillic homoglyph inside an otherwise-ASCII word can carry
 * content a human reviewer cannot see in a diff. That is a prompt-injection
 * surface in an asset we ship to other people's machines.
 *
 * Scope (FR-5.6): the four prompt-carrying globs, each with its own
 * anti-vacuity floor.
 */

const path = require('path');
const fs = require('fs');
const core = require('./lib/validate-core.js');

const SCOPES = [
  { label: 'agents/*.md', min: 13, collect: (root) => core.listFiles(path.join(root, 'agents'), (n) => n.endsWith('.md')) },
  { label: 'skills/*/SKILL.md', min: 5, collect: (root) => core.listNestedFiles(path.join(root, 'skills'), 'SKILL.md') },
  { label: 'src/claude.md', min: 1, collect: (root) => (fs.existsSync(path.join(root, 'src', 'claude.md')) ? [path.join(root, 'src', 'claude.md')] : []) },
  { label: 'src/rules/*.md', min: 5, collect: (root) => core.listFiles(path.join(root, 'src', 'rules'), (n) => n.endsWith('.md')) },
];

const DANGEROUS_CODEPOINTS = [
  { test: (cp) => cp >= 0x200b && cp <= 0x200d, label: 'zero-width character' },
  { test: (cp) => cp === 0x2060, label: 'word joiner' },
  { test: (cp) => cp === 0xfeff, label: 'zero-width no-break space / BOM' },
  { test: (cp) => cp >= 0x202a && cp <= 0x202e, label: 'bidirectional override' },
  { test: (cp) => cp >= 0x2066 && cp <= 0x2069, label: 'bidirectional isolate' },
  { test: (cp) => cp >= 0xe0000 && cp <= 0xe007f, label: 'Unicode tag-block character' },
  { test: (cp) => cp === 0x00ad, label: 'soft hyphen' },
];

/** Cyrillic and Greek letters that render identically to ASCII letters. */
const HOMOGLYPHS = new Map([
  ['а', 'a'], ['е', 'e'], ['о', 'o'], ['р', 'p'], ['с', 'c'],
  ['х', 'x'], ['у', 'y'], ['і', 'i'], ['ј', 'j'], ['һ', 'h'],
  ['А', 'A'], ['В', 'B'], ['Е', 'E'], ['К', 'K'], ['М', 'M'],
  ['Н', 'H'], ['О', 'O'], ['Р', 'P'], ['С', 'C'], ['Т', 'T'],
  ['Х', 'X'], ['Ο', 'O'], ['Α', 'A'], ['Β', 'B'], ['Ε', 'E'],
]);

core.run('validate-unicode-safety', (v, args) => {
  let total = 0;

  for (const scope of SCOPES) {
    const files = scope.collect(args.root);
    const minimum = args.min === null ? scope.min : args.min;
    if (files.length < minimum) {
      v.error('(scope)', `expected at least ${minimum} file(s) matching ${scope.label}, found ${files.length}. A scanner that matches too few files is failing, not passing.`);
      continue;
    }
    total += files.length;

    for (const file of files) {
      const rel = path.relative(args.root, file);
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

      lines.forEach((line, index) => {
        for (const ch of line) {
          const cp = ch.codePointAt(0);
          const danger = DANGEROUS_CODEPOINTS.find((d) => d.test(cp));
          if (danger) {
            v.error(rel, `line ${index + 1}: ${danger.label} (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) — invisible characters must not appear in prompt files`);
          }
          if (HOMOGLYPHS.has(ch)) {
            v.error(rel, `line ${index + 1}: homoglyph ${JSON.stringify(ch)} (U+${cp.toString(16).toUpperCase().padStart(4, '0')}) looks like ASCII "${HOMOGLYPHS.get(ch)}" — use the ASCII character`);
          }
        }
      });
    }
  }

  v.checkedCount = total;
});
