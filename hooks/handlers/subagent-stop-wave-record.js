'use strict';

/**
 * `subagent:stop:wave-record` — records what a wave subagent actually did.
 *
 * Wave execution has always trusted each subagent's self-report: whether its
 * `Verify:` command really ran and passed, which deviation rules fired, and
 * whether it wrote only inside its declared file set. A self-report is the
 * wrong source for all three — it is the same agent grading its own work, and
 * a subagent that never ran its verify command has no way to know it didn't.
 *
 * SubagentStop's payload does NOT carry the subagent's output. Measured
 * directly (docs/findings/subagent-stop-payload.md): `agent_type` and
 * `last_assistant_message` are both absent, despite being documented. What it
 * does carry is `agent_transcript_path`, pointing at the subagent's own
 * transcript on disk — the primary record, present at the moment this fires.
 *
 * So this reads the transcript and writes a structured record the orchestrator
 * consults during post-wave collection, alongside the subagent's own summary.
 * Where the two disagree, the transcript wins.
 *
 * It never blocks. `continue: false` is available on this event and is exactly
 * the wrong tool: forcing a subagent to continue on a misparsed transcript
 * converts a recoverable wave failure into a stuck run, which the autonomy
 * contract's third rule forbids. Report, and let the orchestrator decide.
 *
 * `agent_type` being absent is why records are keyed by `agent_id` alone. The
 * orchestrator knows which id it dispatched for which slice; this hook cannot,
 * and does not guess.
 */

const fs = require('fs');
const path = require('path');

const MAX_TRANSCRIPT_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 2000;

function contentBlocks(record) {
  const message = record && record.message;
  const content = message && message.content;
  return Array.isArray(content) ? content : [];
}

/** Pull the facts a wave cares about out of a subagent transcript. */
function summarise(text) {
  const commands = [];
  const filesWritten = [];
  const toolCounts = {};
  let finalText = '';
  let erroredResults = 0;
  let totalResults = 0;

  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let record = null;
    try {
      record = JSON.parse(line);
    } catch (err) {
      continue; // a truncated trailing line must not lose the rest
    }

    for (const block of contentBlocks(record)) {
      if (!block || typeof block !== 'object') continue;

      if (block.type === 'tool_use') {
        const name = String(block.name || 'unknown');
        toolCounts[name] = (toolCounts[name] || 0) + 1;
        const input = block.input || {};
        if (typeof input.command === 'string') {
          commands.push(input.command.slice(0, 400));
        }
        if (typeof input.file_path === 'string' && (name === 'Edit' || name === 'Write')) {
          if (filesWritten.indexOf(input.file_path) === -1) filesWritten.push(input.file_path);
        }
      } else if (block.type === 'tool_result') {
        totalResults += 1;
        if (block.is_error === true) erroredResults += 1;
      } else if (block.type === 'text' && typeof block.text === 'string') {
        finalText = block.text; // last text block wins: the subagent's answer
      }
    }
  }

  return {
    commands,
    files_written: filesWritten,
    tool_counts: toolCounts,
    tool_results: totalResults,
    tool_results_errored: erroredResults,
    final_text: finalText.slice(0, MAX_TEXT),
  };
}

module.exports = function subagentStopWaveRecord(input, ctx) {
  try {
    const transcriptPath = input && input.agent_transcript_path;
    const agentId = (input && input.agent_id) || 'unknown';
    if (typeof transcriptPath !== 'string' || !transcriptPath) return null;

    const stat = fs.statSync(transcriptPath);
    if (!stat.isFile() || stat.size > MAX_TRANSCRIPT_BYTES) return null;

    const summary = summarise(fs.readFileSync(transcriptPath, 'utf8'));

    const cwd = (ctx && ctx.cwd) || (input && input.cwd) || process.cwd();
    const dir = path.join(cwd, '.claude', 'debug', 'wave-results');
    fs.mkdirSync(dir, { recursive: true });

    // Filename is derived from agent_id, which arrives on stdin. Constrain it
    // rather than interpolating it raw — the same discipline the accumulator
    // applies to session_id.
    const safeId = agentId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
    fs.writeFileSync(
      path.join(dir, safeId + '.json'),
      JSON.stringify(Object.assign({ agent_id: agentId, recorded_at: new Date().toISOString() }, summary), null, 2) + '\n'
    );
  } catch (err) {
    // A record that fails to write must never disturb the wave it observes.
  }

  return null;
};
