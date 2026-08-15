'use strict';

/**
 * One sanitizer, shared by every hook that puts foreign text into a channel a
 * human or a model will read.
 *
 * Two sources of foreign text exist: the project's own scratchpad (read by
 * session:start:spine) and the output of a project-declared command (captured
 * by stop:typecheck-format). Both are repository-controlled — cloning a
 * hostile repo is enough to reach them. They get identical treatment, from
 * this one function, because two sanitizers is how one of them rots.
 *
 * NOTE ON SOURCE FORM: the character classes below use escape sequences, never
 * literal control bytes. A file containing raw control characters is shown by
 * git and code-review tools as "Binary files differ" — and the one file that
 * sanitizes all untrusted input reaching model context is the last file that
 * should be invisible in a diff.
 *
 * What is stripped, and why:
 *   - C0/C1 controls and DEL. ESC is 0x1B, so removing this range removes
 *     every ANSI escape at the source: no colour codes, no cursor movement,
 *     no line-clearing that could forge or hide output in a terminal.
 *   - Zero-width and invisible formatting characters, which can hide text
 *     inside what looks like an innocent string.
 *   - Bidirectional overrides, which can make a string render in an order
 *     completely unlike the bytes it contains.
 *   - Lone surrogates, which are not valid text and can produce malformed
 *     output downstream.
 */

/* eslint-disable no-control-regex */
const CONTROL_CHARS = /[\x00-\x1F\x7F-\x9F]/g;
const INVISIBLE = /[\u200B-\u200F\u2060\uFEFF\u00AD]/g;
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
/* A HIGH surrogate not followed by a low one, or a low surrogate not preceded
 * by a high one. The first alternative must use \uD800-\uDBFF, not the full
 * surrogate range: with the full range the low half of a perfectly valid pair
 * matches (it is a surrogate, and the unit after it is not a low surrogate),
 * so every emoji and non-BMP character would be mangled into exactly the
 * malformed output this rule exists to remove. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])([\uDC00-\uDFFF])/g;
/* eslint-enable no-control-regex */

/**
 * Strip everything invisible or terminal-controlling, collapse whitespace,
 * and trim. Newlines become spaces rather than disappearing, so a multi-line
 * value cannot silently become one word.
 */
function sanitizeText(value) {
  if (value === undefined || value === null) return '';
  let s;
  try {
    s = String(value);
  } catch (err) {
    // A value whose toString throws must not take the caller down with it.
    return '';
  }
  return s
    .replace(CONTROL_CHARS, ' ')
    .replace(INVISIBLE, '')
    .replace(BIDI, '')
    .replace(LONE_SURROGATE, (m) => m.replace(/[\uD800-\uDFFF]/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize and hard-limit a value. Truncation is code-point aware so a
 * surrogate pair is never split into a lone half.
 */
function sanitizeField(value, maxLength) {
  const cleaned = sanitizeText(value);
  const limit = typeof maxLength === 'number' && maxLength > 0 ? maxLength : 200;
  if (cleaned.length <= limit) return cleaned;
  return Array.from(cleaned).slice(0, limit).join('');
}

/**
 * Cap an assembled block, code-point safe, with a visible marker so a reader
 * knows content was dropped rather than never existing.
 */
function capBlock(text, maxChars) {
  let s;
  try {
    s = String(text === undefined || text === null ? '' : text);
  } catch (err) {
    return '';
  }
  const limit = typeof maxChars === 'number' && maxChars > 0 ? maxChars : 4000;
  if (s.length <= limit) return s;
  const marker = '\n[truncated]';
  const keep = Math.max(0, limit - marker.length);
  return Array.from(s).slice(0, keep).join('') + marker;
}

/**
 * Render an untrusted string for display. JSON string encoding turns control
 * bytes into literal backslash sequences, so a hostile value reaches the
 * terminal as visible text rather than as live escapes. Used where the raw
 * value must still be shown — e.g. reporting a command that was NOT run.
 */
function quoteForDisplay(value, maxLength) {
  const limit = typeof maxLength === 'number' && maxLength > 0 ? maxLength : 200;
  let raw;
  try {
    raw = String(value === undefined || value === null ? '' : value);
  } catch (err) {
    raw = '';
  }
  const clipped = Array.from(raw).slice(0, limit).join('');
  return JSON.stringify(clipped);
}

/**
 * Parse an integer from an environment variable and clamp it into range.
 * Env vars are an attack input here: a project's settings can set them, so an
 * unclamped cap could be raised to swallow arbitrary content.
 */
function clampEnvInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

module.exports = { sanitizeText, sanitizeField, capBlock, quoteForDisplay, clampEnvInt };
