'use strict';

/**
 * post:edit:accumulate — PostToolUse on Edit|Write.
 *
 * Records the path that was just edited so `stop:typecheck-format` can run the
 * project's checks ONCE at the end of the response instead of once per edit.
 * On a slice that touches a dozen files that is the difference between one
 * typecheck and twelve.
 *
 * Deliberately does almost nothing: it runs on every single edit, so its cost
 * is paid constantly. No validation, no formatting, no I/O beyond one append.
 *
 * Never blocks — returning normally or throwing both end in exit 0, because
 * the wrapper guarantees it.
 */

const accumulator = require('../lib/accumulator.js');

module.exports = function postEditAccumulate(input) {
  const toolInput = (input && input.tool_input) || {};
  const filePath = toolInput.file_path || toolInput.path || toolInput.notebook_path;

  if (!filePath) {
    // Nothing identifiable was edited (or the payload shape changed upstream).
    // Silence is right here: this fires on every edit and must not chatter.
    return null;
  }

  const root = accumulator.projectRootFromInput(input);
  accumulator.appendPath(root, input && input.session_id, filePath);
  return null;
};
