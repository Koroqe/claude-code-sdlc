'use strict';

/**
 * Quote-aware splitting of a shell command into segments.
 *
 * A naive split on `&&`, `;` and `|` is wrong in both directions, and the
 * false-positive direction is the dangerous one for an unattended pipeline:
 *
 *   git commit -m "feat(core): support a || b in the parser"
 *
 * A naive split turns that into two phantom segments and denies a perfectly
 * legitimate commit — stalling a run over a pipe character inside a message.
 * Tracking quote state fixes that, and catches the separators a naive split
 * misses at the same time (single `&`, single `|`, newline).
 *
 * This is not a shell parser and does not pretend to be. What it cannot see is
 * documented on the guard that uses it.
 */

/** Split on unquoted `&`, `|`, `;` and newline. Returns trimmed segments. */
function splitSegments(command) {
  const text = String(command === undefined || command === null ? '' : command);
  const segments = [];
  let current = '';
  let quote = '';

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      current += ch;
      // A backslash escapes the next character inside double quotes only.
      if (quote === '"' && ch === '\\' && i + 1 < text.length) {
        current += text[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '\\' && i + 1 < text.length) {
      current += ch + text[i + 1];
      i += 1;
      continue;
    }

    if (ch === '&' || ch === '|' || ch === ';' || ch === '\n') {
      segments.push(current);
      current = '';
      continue;
    }

    current += ch;
  }
  segments.push(current);

  return segments.map((s) => s.trim()).filter(Boolean);
}

/**
 * Tokenize one segment, honouring quotes. Quotes are stripped from the token
 * text but recorded, so a caller can tell `SDLC_X=1` (an assignment) from
 * `"SDLC_X=1"` (a quoted string that merely looks like one).
 */
function tokenize(segment) {
  const text = String(segment || '');
  const tokens = [];
  let current = '';
  let quoted = false;
  let started = false;
  let quote = '';

  function push() {
    if (started) tokens.push({ text: current, quoted });
    current = '';
    quoted = false;
    started = false;
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      if (quote === '"' && ch === '\\' && i + 1 < text.length) {
        current += text[i + 1];
        i += 1;
      } else if (ch === quote) {
        quote = '';
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      quoted = true;
      started = true;
      continue;
    }

    if (/\s/.test(ch)) {
      push();
      continue;
    }

    if (ch === '\\' && i + 1 < text.length) {
      current += text[i + 1];
      i += 1;
      started = true;
      continue;
    }

    current += ch;
    started = true;
  }
  push();

  return tokens;
}

/**
 * Strip the prefix words that hide which binary is really being run —
 * `VAR=value`, `env`, `command`, and a leading backslash — and report the
 * resolved basename of the first real token.
 *
 * Returns { name, args, assignments } where `name` is the basename
 * (`/usr/bin/git` → `git`), `args` are the remaining tokens, and
 * `assignments` are the unquoted `VAR=value` prefixes that were stripped.
 */
function resolveCommand(segment) {
  const tokens = tokenize(segment);
  const assignments = [];
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    if (!t.quoted && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t.text)) {
      assignments.push(t.text);
      i += 1;
      continue;
    }
    const bare = t.text.replace(/^\\/, '');
    const base = bare.split('/').pop();
    if (!t.quoted && (base === 'env' || base === 'command')) {
      i += 1;
      continue;
    }
    break;
  }

  if (i >= tokens.length) return { name: '', args: [], assignments };

  const name = tokens[i].text.replace(/^\\/, '').split('/').pop();
  const args = tokens.slice(i + 1).map((t) => t.text);
  return { name, args, assignments };
}

module.exports = { splitSegments, tokenize, resolveCommand };
