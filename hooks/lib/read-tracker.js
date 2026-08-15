'use strict';

/**
 * Records which files have been Read during a session.
 *
 * Deliberately built on the accumulator's helpers rather than reimplementing
 * them: session-id sanitization, symlink refusal and path confinement are
 * exactly the same problems, and two copies of that logic is how one of them
 * rots.
 *
 * The record uses a `.reads` suffix. The Stop hook garbage-collects `.paths`
 * files, and a shared suffix would let it sweep this record mid-session —
 * which would look like "the file was never read" and produce a spurious
 * refusal on the next edit.
 *
 * Paths are stored canonically (resolved, and realpath'd where the file
 * exists) so `./src/a.ts`, `src/a.ts` and an absolute path all compare equal.
 * Without that the guard would refuse edits to files that were genuinely read,
 * which is the failure mode that makes a guard worse than no guard.
 */

const fs = require('fs');
const path = require('path');
const accumulator = require('./accumulator.js');

const SUFFIX = '.reads';
const STALE_MS = 24 * 60 * 60 * 1000;
const GC_LIMIT = 20;

function recordPath(projectRoot, sessionId) {
  const dir = accumulator.accumulatorDir(projectRoot);
  const file = path.resolve(dir, accumulator.sanitizeSessionId(sessionId) + SUFFIX);
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (file.indexOf(prefix) !== 0) return null;
  return file;
}

/** Canonical form of a path, for comparison. */
function canonical(projectRoot, target) {
  const absolute = path.resolve(projectRoot, String(target || ''));
  try {
    return fs.realpathSync(absolute);
  } catch (err) {
    // The file may not exist yet; the resolved form is still comparable.
    return absolute;
  }
}

/** Note that a file was read. Best effort; never throws. */
function recordRead(projectRoot, sessionId, target) {
  if (!accumulator.pathIsSafe(projectRoot)) return false;
  const file = recordPath(projectRoot, sessionId);
  if (!file || !target) return false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, canonical(projectRoot, target) + '\n', 'utf8');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Has this file been read this session?
 *
 * Returns 'yes', 'no', or 'unknown'. The three-way answer is the point:
 *
 *   'no'      — the record exists and this path is not in it. That is a fact
 *               about state, and the guard denies (the remedy is one free
 *               Read). This is the post-compaction case the rule exists for.
 *   'unknown' — the record could not be read at all. That is a mechanism
 *               failure, and the guard must allow. Conflating it with 'no'
 *               would turn a broken disk into a wall of refusals.
 */
function wasRead(projectRoot, sessionId, target) {
  if (!accumulator.pathIsSafe(projectRoot)) return 'unknown';
  const file = recordPath(projectRoot, sessionId);
  if (!file) return 'unknown';

  let text;
  try {
    if (!fs.existsSync(file)) return 'no';
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return 'unknown';
  }

  const wanted = canonical(projectRoot, target);
  for (const line of text.split('\n')) {
    if (line.trim() === wanted) return 'yes';
  }
  return 'no';
}

/** Bounded, best-effort cleanup of records left by sessions that never ended. */
function collectGarbage(projectRoot, keepSessionId) {
  if (!accumulator.pathIsSafe(projectRoot)) return 0;
  const dir = accumulator.accumulatorDir(projectRoot);
  const keep = accumulator.sanitizeSessionId(keepSessionId) + SUFFIX;
  let removed = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    for (const name of fs.readdirSync(dir)) {
      if (removed >= GC_LIMIT) break;
      if (name === keep || !name.endsWith(SUFFIX)) continue;
      const full = path.join(dir, name);
      try {
        const stat = fs.lstatSync(full);
        if (!stat.isFile()) continue;
        if (Date.now() - stat.mtimeMs < STALE_MS) continue;
        fs.unlinkSync(full);
        removed += 1;
      } catch (err) { /* skip */ }
    }
  } catch (err) { /* best effort */ }
  return removed;
}

module.exports = { SUFFIX, recordPath, canonical, recordRead, wasRead, collectGarbage };
