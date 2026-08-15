'use strict';

/**
 * pre:edit:read-guard — one handler, two events.
 *
 *   PostToolUse on Read       → records that the file was read
 *   PreToolUse on Edit|Write  → refuses an edit to a file not read this session
 *
 * This mechanises the re-read-before-edit rule, which exists because context
 * compaction can silently replace an earlier file read with a summary. The
 * model then edits against remembered content that no longer matches disk —
 * and the moment that is most likely is exactly the moment nobody notices.
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

module.exports = function readGuard(input) {
  const event = (input && input.hook_event_name) || '';
  const toolInput = (input && input.tool_input) || {};
  const target = toolInput.file_path || toolInput.notebook_path;
  if (!target) return null;

  const root = (input && input.cwd) || process.cwd();
  const sessionId = input && input.session_id;

  // --- recorder half ------------------------------------------------------
  if (event === 'PostToolUse') {
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
