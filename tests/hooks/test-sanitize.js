#!/usr/bin/env node
'use strict';

/**
 * Unit tests for the shared sanitizer (hooks/lib/sanitize.js).
 *
 * Escape sequences only — never literal control bytes. A test file full of raw
 * control characters renders as a binary diff, which is how the bug these
 * tests guard against got into the sanitizer in the first place.
 */

const path = require('path');
const { Checks, REPO_ROOT } = require('./harness');
const s = require(path.join(REPO_ROOT, 'hooks', 'lib', 'sanitize.js'));

const c = new Checks('sanitize');

// --- valid astral text must survive untouched ----------------------------
// A "lone high surrogate" rule written with the FULL surrogate range matches
// the low half of every valid pair — stripping it, and leaving behind exactly
// the malformed output the rule exists to remove. Emoji are the canary.
c.equal('emoji survives', s.sanitizeText('hello \u{1F600} world'), 'hello \u{1F600} world');
c.equal('non-BMP CJK survives', s.sanitizeText('\u{2000B} ok'), '\u{2000B} ok');
c.equal('flag sequence survives', s.sanitizeText('\u{1F1EC}\u{1F1E7}'), '\u{1F1EC}\u{1F1E7}');

// --- lone halves are removed ---------------------------------------------
c.equal('lone high surrogate removed', s.sanitizeText('a\uD800b'), 'ab');
c.equal('lone low surrogate removed', s.sanitizeText('a\uDC00b'), 'ab');

// --- invisible and terminal-controlling characters ------------------------
c.equal('ESC removed', s.sanitizeText('a\u001b[31mb'), 'a [31mb');
c.equal('NUL removed', s.sanitizeText('a\u0000b'), 'a b');
c.equal('DEL removed', s.sanitizeText('a\u007fb'), 'a b');
c.equal('zero-width space removed', s.sanitizeText('a\u200bb'), 'ab');
c.equal('BOM removed', s.sanitizeText('a\ufeffb'), 'ab');
c.equal('bidi override removed', s.sanitizeText('a\u202eb'), 'ab');
c.equal('soft hyphen removed', s.sanitizeText('a\u00adb'), 'ab');
c.equal('newline becomes a space', s.sanitizeText('a\nb'), 'a b');
c.equal('runs of whitespace collapse', s.sanitizeText('a    b'), 'a b');

// --- hostile values must not take the caller down ------------------------
c.equal('throwing toString yields empty',
  s.sanitizeText({ toString() { throw new Error('x'); } }), '');
c.equal('null yields empty', s.sanitizeText(null), '');

// --- caps are code-point aware -------------------------------------------
c.equal('field cap counts code points, not UTF-16 units',
  Array.from(s.sanitizeField('\u{1F600}'.repeat(10), 3)).length, 3);
c.ok('block cap marks truncation', s.capBlock('x'.repeat(100), 50).indexOf('[truncated]') !== -1);
c.ok('block under the cap is untouched', s.capBlock('short', 50) === 'short');

// --- display quoting renders control bytes inert -------------------------
const quoted = s.quoteForDisplay('curl \u001b[2K evil');
c.ok('quoted output carries no raw ESC', quoted.indexOf('\u001b') === -1, quoted);
c.ok('quoted output still shows the text', quoted.indexOf('curl') !== -1);

// --- env clamping ---------------------------------------------------------
c.equal('clamp above max', s.clampEnvInt('999999999', 4000, 200, 8000), 8000);
c.equal('clamp below min', s.clampEnvInt('1', 4000, 200, 8000), 200);
c.equal('unparseable falls back', s.clampEnvInt('banana', 4000, 200, 8000), 4000);
c.equal('absent falls back', s.clampEnvInt(undefined, 4000, 200, 8000), 4000);

c.finish();
