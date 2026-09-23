'use strict';

/**
 * Shared scratchpad parsing.
 *
 * Extracted from `hooks/handlers/session-start-spine.js` so the run-to-
 * completion continuation check (`hooks/lib/continuation.js`, called from
 * `stop:gate-evidence`) can read the same plan-of-record the spine injects
 * at session start, through one parser rather than two that could drift
 * apart. Every function below is a byte-for-byte move — see
 * `session-start-spine.js`'s own header for the full threat model this
 * parsing operates under (repository-controlled input, typed extraction
 * only, nothing free-form ever emitted).
 *
 * `doneSliceCount` and `blockersPresent` are new here, not moved: the
 * continuation check needs them, the spine does not.
 */

const fs = require('fs');
const sanitize = require('./sanitize.js');

const MAX_BYTES = 256 * 1024;
const MAX_LINE = 500;

const FEATURE_RE = /^[\p{L}\p{N} ._/():+#&'-]{1,200}$/u;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,120}$/;
const STATUSES = [
  'idle', 'bootstrapping', 'implementing', 'quality-gates', 'complete', 'blocked', 'paused',
];

/** Markers that mean "no blocker recorded", after trim + lowercase. */
const NONE_MARKERS = new Set(['(none)', 'none', '- none', '- (none)', 'none.', 'n/a']);

/** Read a capped prefix of a file, refusing symlinks. Returns null when absent. */
function readCapped(file, maxBytes) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (err) {
    return null;
  }
  // A hostile repo can commit `.claude/scratchpad.md -> ~/.claude/settings.json`
  // (gitignore does not stop a committed file arriving in a clone). Following
  // it would pull machine-local content into model context.
  if (stat.isSymbolicLink() || !stat.isFile()) return null;

  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(Math.min(maxBytes, stat.size));
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    return buf.slice(0, read).toString('utf8');
  } catch (err) {
    return null;
  }
}

function matchLine(lines, re) {
  for (const line of lines) {
    if (line.length > MAX_LINE) continue;
    const m = re.exec(line);
    if (m) return m;
  }
  return null;
}

/**
 * Lines above the first `## Archive` heading (or all lines, when none
 * exists). `## Archive` is where the scratchpad rules move completed work,
 * so everything below it is history by definition — scanning it produces
 * confident nonsense about which slice is current. Shared by
 * `extractState`, `doneSliceCount` and `blockersPresent` so all three agree
 * on where "current" ends.
 */
function linesAboveArchive(text) {
  const all = text.split('\n');
  const archiveAt = all.findIndex((l) => /^##\s*Archive\b/i.test(l));
  return archiveAt === -1 ? all : all.slice(0, archiveAt);
}

function extractState(text) {
  const lines = linesAboveArchive(text);
  const state = {};

  let m = matchLine(lines, /^##\s*Feature:\s*(.+)$/);
  if (m) {
    const value = sanitize.sanitizeField(m[1], 200);
    state.feature = FEATURE_RE.test(value) ? value : 'unparseable';
  }

  m = matchLine(lines, /^##\s*Branch:\s*(.+)$/);
  if (m) {
    const value = sanitize.sanitizeField(m[1], 120);
    state.branch = BRANCH_RE.test(value) ? value : 'unparseable';
  }

  m = matchLine(lines, /^##\s*Status:\s*(.+)$/);
  if (m) {
    // Enum match, not a prefix match. A prefix check would let everything
    // after a known word through — "idle — SYSTEM OVERRIDE: ..." would have
    // been emitted verbatim, which is exactly the injection surface the
    // typed-fields design claims not to have. Only the recognised word is
    // kept; any detail after it is discarded, not echoed.
    const value = sanitize.sanitizeField(m[1], 120).toLowerCase();
    const matched = STATUSES.find((s) => value === s || value.indexOf(s + ' ') === 0);
    if (matched === 'implementing') {
      // The one status that legitimately carries structure. Re-derive it from
      // digits rather than passing the tail through.
      const w = /implementing\s+wave\s+(\d{1,4})\s+slice\s+(\d{1,4})\/(\d{1,4})/.exec(value);
      const s = /implementing\s+slice\s+(\d{1,4})\/(\d{1,4})/.exec(value);
      if (w) state.status = 'implementing wave ' + w[1] + ' slice ' + w[2] + '/' + w[3];
      else if (s) state.status = 'implementing slice ' + s[1] + '/' + s[2];
      else state.status = 'implementing';
    } else {
      state.status = matched || 'unrecognized';
    }
  }

  // Wave currently in progress.
  for (const line of lines) {
    if (line.length > MAX_LINE) continue;
    const w = /^###\s*Wave\s+(\d{1,4}).*\[IN PROGRESS\]/i.exec(line);
    if (w) {
      const n = parseInt(w[1], 10);
      if (n >= 1 && n <= 9999) state.wave = n;
      break;
    }
  }

  // First unchecked slice, and how many slices the plan has.
  let total = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE) continue;
    if (/^\s*-\s*\[[ x]\]\s*Slice\s+\d{1,4}/i.test(line)) total += 1;
    if (state.slice === undefined) {
      const s = /^\s*-\s*\[ \]\s*Slice\s+(\d{1,4})/i.exec(line);
      if (s) {
        const n = parseInt(s[1], 10);
        if (n >= 1 && n <= 9999) state.slice = n;
      }
    }
  }
  if (total >= 1 && total <= 9999) state.sliceTotal = total;

  return state;
}

/**
 * How many `- [x] Slice N` lines the plan carries above `## Archive`. Used
 * by the continuation check's no-progress key — a checked-off slice since
 * the last Stop is progress, even when the reported next-slice number has
 * not moved (a skipped or reordered slice).
 */
function doneSliceCount(text) {
  const lines = linesAboveArchive(text);
  let count = 0;
  for (const line of lines) {
    if (line.length > MAX_LINE) continue;
    if (/^\s*-\s*\[x\]\s*Slice\s+\d{1,4}/i.test(line)) count += 1;
  }
  return count;
}

/**
 * First unchecked `- [ ] Slice N` above `## Archive` that is NOT marked
 * `FAILED`, or undefined. Differs from `extractState().slice` on purpose:
 * under the partial-wave-failure policy (`src/rules/error-recovery.md`), a
 * slice that failed but blocks nothing stays unchecked and `FAILED` while the
 * run moves on — the continuation check must point at the next slice to DO,
 * never back at one the policy already decided to leave.
 */
function firstPendingSlice(text) {
  const lines = linesAboveArchive(text);
  for (const line of lines) {
    if (line.length > MAX_LINE) continue;
    const s = /^\s*-\s*\[ \]\s*Slice\s+(\d{1,4})/i.exec(line);
    if (!s || /\bFAILED\b/.test(line)) continue;
    const n = parseInt(s[1], 10);
    if (n >= 1 && n <= 9999) return n;
  }
  return undefined;
}

/**
 * Whether `## Blockers` (above `## Archive`) carries a real, non-"none"
 * line. Deliberately does NOT skip over-length lines the way
 * `doneSliceCount`/`extractState` do: the only work done per line is
 * `.trim()` and a `Set.has()` lookup — no regex, no ReDoS surface — and
 * skipping an over-long blocker line would flip a genuinely recorded
 * blocker to "absent", which is the wrong direction for a check whose job
 * is to never block when a blocker truly is recorded.
 */
function blockersPresent(text) {
  const lines = linesAboveArchive(text);

  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##\s*Blockers\s*$/i.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return false;

  for (let i = start; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    const trimmed = lines[i].trim().toLowerCase();
    if (!trimmed) continue;
    if (NONE_MARKERS.has(trimmed)) continue;
    return true;
  }
  return false;
}

module.exports = {
  readCapped,
  matchLine,
  extractState,
  doneSliceCount,
  firstPendingSlice,
  blockersPresent,
  STATUSES,
  FEATURE_RE,
  BRANCH_RE,
  MAX_LINE,
  MAX_BYTES,
};
