'use strict';

/**
 * pre:edit:read-guard — one handler, two events.
 *
 *   PostToolUse on Read|Write → records freshness for the touched file
 *                               (hooks.json's matcher routes both; it is an
 *                               unanchored regex, so tool names merely
 *                               *containing* Read or Write also land here —
 *                               deliberate breadth: this half only records)
 *   PreToolUse on Edit|Write  → refuses an edit to a file not read this session
 *
 * This mechanises the re-read-before-edit rule, which exists because context
 * compaction can silently replace an earlier file read with a summary. The
 * model then edits against remembered content that no longer matches disk —
 * and the moment that is most likely is exactly the moment nobody notices.
 *
 * Errored responses (FR-3.6, M14/M15): a Write whose tool_response carries a
 * *definite* error indicator (own is_error === true, or a truthy own error
 * property) did not put the model's content on disk, so it must not mint
 * freshness — the recorder returns without recording. The check is scoped to
 * tool_name === 'Write' ONLY: Read behavior stays byte-identical to the
 * pre-widening guard, so an errored Read keeps minting freshness exactly as
 * it always did (no new refusals). Anything unclassifiable — absent response,
 * non-object, unrecognized shape, or an inspection that throws — FAILS OPEN
 * and records. And tool_name absent or non-string simply is not 'Write', so
 * it records too: a permissive default, never an allowlist, because a future
 * payload-shape change must degrade to recording, not to mass refusals.
 *
 * On a missing record the guard DENIES. That is deliberate asymmetry: a lost
 * record (new session after a resume, GC, compaction) costs one free Read to
 * resolve, and refusing is the rule being enforced. But an *unreadable* record
 * is a mechanism failure and allows — a broken disk must not become a wall of
 * refusals.
 *
 * Creating a new file is never a violation: there is nothing to have read.
 *
 * Backstop: merge-ready Gate 4 (build). An edit made against stale context
 * usually fails to compile, which is the same defect caught later and louder.
 */

const fs = require('fs');
const path = require('path');
const tracker = require('../lib/read-tracker.js');

const ESCAPE = 'SDLC_ALLOW_UNREAD_EDIT';

/**
 * Is this tool_response a *definite* error? (M14)
 *
 * Own-property reads only, each field read exactly once, is_error compared
 * strictly against true. The catch branch returns false — i.e. RECORDS —
 * because a throwing inspection must not become silent suppression; that
 * would invert the fail-open direction.
 */
function writeErrored(input) {
  try {
    const resp = input.tool_response;
    if (!resp || typeof resp !== 'object') return false;
    const has = Object.prototype.hasOwnProperty;
    if (has.call(resp, 'is_error') && resp.is_error === true) return true;
    if (has.call(resp, 'error') && resp.error) return true;
    return false;
  } catch (err) {
    return false;
  }
}

module.exports = function readGuard(input) {
  const event = (input && input.hook_event_name) || '';
  const toolInput = (input && input.tool_input) || {};
  const target = toolInput.file_path || toolInput.notebook_path;
  if (!target) return null;

  const root = (input && input.cwd) || process.cwd();
  const sessionId = input && input.session_id;

  // --- recorder half ------------------------------------------------------
  if (event === 'PostToolUse') {
    // M15: only a Write's response is inspected — a Write that detectably
    // failed never put its content on disk, so it must not mint freshness.
    // Every other tool_name (Read included, absent or non-string included)
    // falls straight through to recording: FR-3.6(b)'s permissive default.
    if (input.tool_name === 'Write' && writeErrored(input)) return null;
    tracker.recordRead(root, sessionId, target);
    tracker.collectGarbage(root, sessionId);
    // Even if this half tried to refuse, the wrapper drops decisions for
    // PostToolUse — the recorder is structurally incapable of blocking.
    return null;
  }

  if (event !== 'PreToolUse') return null;

  // --- gate half ----------------------------------------------------------
  const absolute = path.resolve(root, String(target));
  let exists = false;
  try {
    exists = fs.existsSync(absolute);
  } catch (err) {
    return null;
  }
  // Nothing on disk means nothing to have read.
  if (!exists) return null;

  const seen = tracker.wasRead(root, sessionId, target);
  if (seen === 'yes' || seen === 'unknown') return null;

  if (process.env[ESCAPE] === '1') {
    return {
      systemMessage: 'read-guard bypassed via ' + ESCAPE + ': ' + path.relative(root, absolute),
    };
  }

  return {
    deny: {
      reason:
        'Refusing to edit ' + path.relative(root, absolute) + ' — it has not been ' +
        'read in this session. Read it first: what you remember of a file may ' +
        'predate a context compaction, and editing against a stale memory ' +
        'silently discards whatever changed. Read the file, then retry this ' +
        'edit unchanged. Override with ' + ESCAPE + '=1. ' +
        '[deviation: rule-1 — Read the file, then retry, free]',
    },
  };
};
