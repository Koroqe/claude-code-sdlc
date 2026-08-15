'use strict';

/**
 * pre:agent:isolation-guard — PreToolUse on Edit|Write.
 *
 * Spike finding: field agent_id / agent_type — present in subagent context,
 * absent in orchestrator context. Captured empirically on 2026-08-15; see
 * docs/spikes/blocking-guards_subagent-indicator_spike.md. `session_id` is
 * shared between orchestrator and subagent and cannot distinguish them.
 *
 * The rule being mechanised: during a parallel wave, only the orchestrator
 * writes `.claude/scratchpad.md` and `CHANGELOG.md`. Several subagents editing
 * the same two files concurrently is how a wave corrupts its own record of
 * what happened. Until now this lived only in prose, restated in three files.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GUARD HONESTLY IS.
 *
 * The indicator is harness-authored: a subagent's prompt cannot alter hook
 * stdin, and repository content cannot either — they can only make tool calls,
 * which the harness annotates. So the field is as trustworthy as `tool_name`
 * is.
 *
 * ACCEPTED RESIDUAL, stated plainly because it is easy to miss: absence of the
 * field is treated as "orchestrator, allow". That is correct today — the
 * orchestrator's payload genuinely has no `agent_id`. But the field is
 * undocumented, so if a future release stopped sending it, every subagent
 * write would be allowed while this guard still looked installed. Warning on
 * every absence is not the answer: absence is the common case, and a warning
 * on every orchestrator write would be pure noise that trains people to ignore
 * it. The detector is instead a test — tests/hooks/test-guard-isolation.js
 * asserts the captured subagent fixture still carries the field, and the spike
 * record says to re-capture it when Claude Code updates. A present-but-empty
 * field is the one shape that does warn, since that is malformed rather than
 * normal.
 *
 * It also only sees Edit and Write. A subagent appending to the scratchpad via
 * Bash bypasses it completely, by construction. This guard must never be
 * described as enforcing the isolation rule generally.
 *
 * Backstops: the changelog idempotency guard, and merge-ready Gate 0.
 * ---------------------------------------------------------------------------
 */

const path = require('path');
const sanitize = require('../lib/sanitize.js');

const ESCAPE = 'SDLC_ALLOW_SUBAGENT_WRITE';
const PROTECTED = ['.claude/scratchpad.md', 'CHANGELOG.md'];

function protectedRelative(root, target) {
  const absolute = path.resolve(root, String(target || ''));
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  // macOS and Windows default to case-insensitive filesystems, so `changelog.md`
  // reaches the same file as `CHANGELOG.md` and must match the same rule.
  const lower = relative.toLowerCase();
  const hit = PROTECTED.find((p) => p.toLowerCase() === lower);
  return hit ? relative : '';
}

module.exports = function isolationGuard(input) {
  const event = (input && input.hook_event_name) || '';
  if (event !== 'PreToolUse') return null;

  const toolInput = (input && input.tool_input) || {};
  const target = toolInput.file_path;
  if (!target) return null;

  const root = path.resolve((input && input.cwd) || process.cwd());
  const relative = protectedRelative(root, target);
  if (!relative) return null;

  const agentId = input && input.agent_id;
  const agentType = input && input.agent_type;
  const hasIndicator = typeof agentId === 'string' && agentId.length > 0;

  // No indicator at all. Today that means the orchestrator — but saying so
  // silently is how this guard would rot into a no-op after a harness change,
  // so it says so out loud instead, and still allows.
  if (!hasIndicator) {
    if (typeof agentId !== 'undefined' || typeof agentType !== 'undefined') {
      return {
        systemMessage:
          'isolation-guard: could not determine whether this write to ' + relative +
          ' came from a subagent — the origin field was present but empty. ' +
          'The orchestrator-only rule is not mechanically enforced for this ' +
          'call; merge-ready Gate 0 and the changelog idempotency guard remain ' +
          'the checks that catch a conflict.',
      };
    }
    return null;
  }

  if (process.env[ESCAPE] === '1') {
    return {
      systemMessage:
        'isolation-guard bypassed via ' + ESCAPE + ': subagent write to ' + relative,
    };
  }

  return {
    deny: {
      reason:
        'Refusing a subagent write to ' + relative + ' (agent type ' +
        sanitize.quoteForDisplay(agentType || 'unknown', 40) + '). During a ' +
        'parallel wave the orchestrator owns this file; several subagents ' +
        'writing it at once is how a wave loses its own record of what ' +
        'happened. Return your findings in your response instead and let the ' +
        'orchestrator record them. Override with ' + ESCAPE + '=1. ' +
        '[deviation: rule-3 — return findings to the orchestrator instead, costs 1 retry]',
    },
  };
};
