'use strict';

/**
 * pre:write:shrink-guard — PreToolUse on Write.
 *
 * Refuses a whole-file Write that would gut a curated artifact.
 *
 * The failure this exists for: a model asked to update one section of a long
 * document reconstructs the whole file from what it can currently see, and
 * everything outside that window silently disappears. It looks like a normal
 * edit. A community harness recorded a planner collapsing a 292-line roadmap
 * to 16 lines exactly this way.
 *
 * The rule is deliberately crude — a line-count ratio, not an understanding of
 * content — because the failure is crude too. A legitimate rewrite that really
 * does shorten a document sets the escape and says so.
 *
 * This guard polices model drift, not a hostile repository. Backstop:
 * merge-ready Gate 1 (documentation completeness).
 */

const fs = require('fs');
const path = require('path');

const SHRINK_RATIO = 0.4;
const FLOOR_LINES = 40;
const ESCAPE = 'SDLC_ALLOW_SHRINK';

/** Curated artifacts: long-lived, hand-built, expensive to reconstruct. */
function isCurated(relative) {
  if (relative === '.claude/scratchpad.md') return true;
  if (relative === 'docs/PRD.md') return true;
  if (relative === 'CHANGELOG.md') return true;
  if (/^docs\/use-cases\/[^/]+$/.test(relative)) return true;
  if (/^docs\/qa\/[^/]+$/.test(relative)) return true;
  return false;
}

function countLines(text) {
  if (!text) return 0;
  const s = String(text);
  const n = s.split('\n').length;
  // A trailing newline should not count as an extra line.
  return s.endsWith('\n') ? n - 1 : n;
}

module.exports = function shrinkGuard(input) {
  const toolInput = (input && input.tool_input) || {};
  const target = toolInput.file_path;
  if (!target) return null;

  const root = path.resolve((input && input.cwd) || process.cwd());
  const absolute = path.resolve(root, target);
  const relative = path.relative(root, absolute);

  // Outside the project, or not a curated artifact — not this guard's business.
  if (relative.startsWith('..') || !isCurated(relative)) return null;

  let existing = '';
  try {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink() || !stat.isFile()) return null;
    existing = fs.readFileSync(absolute, 'utf8');
  } catch (err) {
    // No such file yet: a first write cannot shrink anything.
    return null;
  }

  const oldLines = countLines(existing);
  const newLines = countLines(toolInput.content);
  const threshold = Math.max(Math.floor(oldLines * SHRINK_RATIO), FLOOR_LINES);

  if (oldLines === 0 || newLines >= threshold) return null;

  if (process.env[ESCAPE] === '1') {
    return {
      systemMessage:
        'shrink-guard bypassed via ' + ESCAPE + ': ' + relative +
        ' ' + oldLines + ' → ' + newLines + ' lines',
    };
  }

  return {
    deny: {
      reason:
        'Refusing to shrink ' + relative + ' from ' + oldLines + ' to ' + newLines +
        ' lines (below the ' + threshold + '-line floor). A whole-file Write ' +
        'replaces everything, so any section outside what you are currently ' +
        'looking at would be lost. Use Edit to change the part you mean, or ' +
        'Write the complete file. If the document really is meant to shrink, ' +
        'set ' + ESCAPE + '=1. ' +
        '[deviation: rule-1 — use Edit or write the full content, free]',
    },
  };
};
