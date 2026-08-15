'use strict';

/**
 * Shared path derivation for the edited-paths accumulator.
 *
 * `post:edit:accumulate` appends here; `stop:typecheck-format` reads and
 * clears it. Both must agree on the location, so it lives in one place.
 *
 * Design constraints (PRD Section 7, FR-6.1–6.6):
 *   - Project-local, under .claude/tmp/. NOT /tmp — a shared temp directory is
 *     Windows-hostile and invites collisions between unrelated projects, and a
 *     community harness that did this silently no-ops when its writer is not
 *     running. NOT $HOME, and never .claude/scratchpad.md.
 *   - Keyed by session_id, the only identity both PostToolUse and Stop share.
 *   - session_id arrives on stdin. It is NEVER trusted for path construction:
 *     it is sanitized to [A-Za-z0-9_-] and the resolved path is then asserted
 *     to be a descendant of .claude/tmp/ before anything is written.
 *   - The project root comes from stdin's `cwd`, not process.cwd() — the hook
 *     process may be started anywhere.
 *
 * This module must not import from scripts/ci/lib/: CI tooling and the hook
 * runtime are separate zones with different failure postures.
 */

const fs = require('fs');
const path = require('path');

const TMP_DIRNAME = path.join('.claude', 'tmp');
const STALE_MS = 24 * 60 * 60 * 1000;
const GC_LIMIT = 20;

/**
 * Reduce a session id to characters that are safe in a filename. Anything
 * else — path separators, dots, null bytes, shell metacharacters, unicode —
 * becomes an underscore. An empty or missing id becomes a fixed fallback so a
 * malformed payload still gets a valid, confined path.
 */
function sanitizeSessionId(sessionId) {
  const raw = String(sessionId === undefined || sessionId === null ? '' : sessionId);
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'unknown-session';
}

/** Absolute path of the accumulator directory for a given project root. */
function accumulatorDir(projectRoot) {
  return path.join(path.resolve(projectRoot), TMP_DIRNAME);
}

/**
 * Absolute path of one session's accumulator file, or null when the result
 * would escape the accumulator directory. Callers must treat null as "do not
 * write" rather than falling back to some other location.
 */
function accumulatorPath(projectRoot, sessionId) {
  const dir = accumulatorDir(projectRoot);
  const file = path.resolve(dir, sanitizeSessionId(sessionId) + '.paths');

  // Belt and braces. Sanitization already removes separators and dots, so this
  // should be unreachable — which is exactly why it is worth asserting: if a
  // future edit weakens the sanitizer, this still refuses.
  const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
  if (file !== dir && file.indexOf(prefix) !== 0) {
    return null;
  }
  return file;
}

/**
 * Refuse to touch the accumulator through a symlink.
 *
 * A hostile repository can commit `.claude/tmp -> /somewhere/else` (gitignore
 * does not stop a committed path arriving in a clone). Following it would make
 * every Edit in that repo write outside the project, and would let the
 * age-based GC unlink the adopter's files.
 *
 * This lives here, not in the callers, so every caller inherits it. The first
 * version of this code guarded only in the Stop hook, and the accumulate hook
 * — which runs on every single edit — silently didn't.
 */
function pathIsSafe(projectRoot) {
  const candidates = [path.join(path.resolve(projectRoot), '.claude'), accumulatorDir(projectRoot)];
  for (const dir of candidates) {
    let stat;
    try {
      stat = fs.lstatSync(dir);
    } catch (err) {
      continue; // absent is fine — it will be created as a real directory
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
  }
  return true;
}

/** Resolve the project root from a hook stdin payload. */
function projectRootFromInput(input) {
  if (input && typeof input.cwd === 'string' && input.cwd) {
    return input.cwd;
  }
  return process.cwd();
}

/** Append one path. Returns true when written. */
function appendPath(projectRoot, sessionId, filePath) {
  const file = accumulatorPath(projectRoot, sessionId);
  if (!file || !filePath) return false;
  if (!pathIsSafe(projectRoot)) return false;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Append mode: small O_APPEND writes are atomic on POSIX, so parallel-wave
  // subagents editing within one session interleave without corrupting lines.
  fs.appendFileSync(file, String(filePath) + '\n', 'utf8');
  return true;
}

/** Read the accumulated paths, de-duplicated, tolerating a corrupt file. */
function readPaths(projectRoot, sessionId) {
  if (!pathIsSafe(projectRoot)) return [];
  const file = accumulatorPath(projectRoot, sessionId);
  if (!file || !fs.existsSync(file)) return [];

  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return [];
  }

  const seen = Object.create(null);
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || seen[trimmed]) continue;
    seen[trimmed] = true;
    out.push(trimmed);
  }
  return out;
}

/** Remove this session's own file. Never throws. */
function clear(projectRoot, sessionId) {
  if (!pathIsSafe(projectRoot)) return;
  const file = accumulatorPath(projectRoot, sessionId);
  if (!file) return;
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    /* best effort */
  }
}

/**
 * Remove stale accumulator files left by sessions that were killed before
 * their Stop hook ran. Bounded and best-effort — never throws, never touches
 * anything outside the accumulator directory, and never removes a file that
 * is not ours by name.
 */
function collectGarbage(projectRoot, keepSessionId) {
  if (!pathIsSafe(projectRoot)) return 0;
  const dir = accumulatorDir(projectRoot);
  const keep = sanitizeSessionId(keepSessionId) + '.paths';
  let removed = 0;

  try {
    if (!fs.existsSync(dir)) return 0;
    for (const name of fs.readdirSync(dir)) {
      if (removed >= GC_LIMIT) break;
      if (name === keep || !name.endsWith('.paths')) continue;
      const full = path.join(dir, name);
      try {
        const stat = fs.lstatSync(full);
        if (!stat.isFile()) continue;
        if (Date.now() - stat.mtimeMs < STALE_MS) continue;
        fs.unlinkSync(full);
        removed += 1;
      } catch (err) {
        /* skip this entry */
      }
    }
  } catch (err) {
    /* best effort */
  }
  return removed;
}

module.exports = {
  TMP_DIRNAME,
  pathIsSafe,
  STALE_MS,
  GC_LIMIT,
  sanitizeSessionId,
  accumulatorDir,
  accumulatorPath,
  projectRootFromInput,
  appendPath,
  readPaths,
  clear,
  collectGarbage,
};
