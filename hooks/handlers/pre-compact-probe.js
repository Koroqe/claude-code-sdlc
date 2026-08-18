'use strict';

/**
 * `pre:compact:probe` — records what PreCompact actually carries.
 *
 * Compaction is the single largest threat to a long unattended run: state the
 * orchestrator needs is summarised away mid-feature. Before building anything
 * that reacts to it, this harness needs to know what the event actually
 * provides, and that could not be established any other way:
 *
 *   - Documentation claims `compact_trigger: "manual" | "auto"`. Unverified.
 *   - Hooks registered in `~/.claude/settings.json` do NOT execute under
 *     headless `claude -p` on the machine this was developed against —
 *     measured directly, including a capture on `Stop`, which fires on every
 *     response and still never ran. Plugin hooks DO execute there, so this is
 *     the only channel that can observe the event.
 *   - Compaction cannot be forced headlessly: `/compact` is inert under `-p`,
 *     and auto-compaction did not trigger across chained `--continue` turns
 *     even with `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=1`.
 *
 * So this ships as a probe rather than a mechanism. It writes the payload it
 * receives to `.claude/debug/precompact-payload.jsonl` and does nothing else —
 * no blocking, no injected context, no decision. When a real session compacts,
 * the schema lands on disk and the compaction feature can then be designed
 * against something observed instead of something assumed.
 *
 * Deliberately NOT done here: blocking compaction. `continue: false` is
 * documented as available, and it is the wrong tool for an unattended run — a
 * run that refuses to compact exhausts its context instead, which converts a
 * recoverable summarisation into a dead end. The autonomy contract's third
 * rule forbids exactly that.
 *
 * Fail-open in every branch: an unwritable directory, a malformed payload, or
 * any throw leaves the session untouched.
 */

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 64 * 1024;

module.exports = function preCompactProbe(input, ctx) {
  try {
    const cwd = (ctx && ctx.cwd) || (input && input.cwd) || process.cwd();
    const dir = path.join(cwd, '.claude', 'debug');
    fs.mkdirSync(dir, { recursive: true });

    const record = JSON.stringify({
      observed_at: new Date().toISOString(),
      payload: input,
    });
    if (record.length <= MAX_BYTES) {
      fs.appendFileSync(path.join(dir, 'precompact-payload.jsonl'), record + '\n');
    }
  } catch (err) {
    // A diagnostic that breaks the thing it observes is worse than no
    // diagnostic. Nothing here is worth disturbing a compaction for.
  }

  // No decision, no context, no systemMessage — a probe must not change the
  // behaviour it is measuring.
  return null;
};
