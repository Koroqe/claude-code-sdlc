#!/usr/bin/env node
'use strict';

/**
 * Validates `hooks/hooks.json` when it exists.
 *
 * The harness ships no hooks until roadmap feature F2a, so an absent file is a
 * legitimate PASS here — but the parser is real, not a stub (QA 18.4.3). The
 * moment a hooks.json appears it is checked properly, which is the point: the
 * validator must not silently start passing garbage the day hooks land.
 *
 * Anti-vacuity (FR-5.9) applies conditionally: absent file -> pass with an
 * explicit note; present file -> must declare at least one hook entry, since a
 * hooks.json that registers nothing is a configuration mistake.
 */

const path = require('path');
const fs = require('fs');
const core = require('./lib/validate-core.js');

const VALID_EVENTS = new Set([
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied', 'Stop',
  'StopFailure', 'SubagentStart', 'SubagentStop', 'PreCompact', 'FileChanged',
  'CwdChanged', 'ConfigChange', 'TaskCreated', 'TaskCompleted',
  'WorktreeCreate', 'WorktreeRemove',
]);

const VALID_HANDLER_TYPES = new Set(['command', 'http', 'mcp_tool', 'prompt', 'agent']);

core.run('validate-hooks', (v, args) => {
  const file = path.join(args.root, 'hooks', 'hooks.json');

  if (!fs.existsSync(file)) {
    process.stdout.write('note: no hooks/hooks.json present — expected until roadmap feature F2a\n');
    v.requireMinimum(0, 0, 'hook configuration files');
    return;
  }

  const rel = path.relative(args.root, file);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    v.error(rel, `is not valid JSON: ${err.message}`);
    v.requireMinimum(1, 1, 'hook configuration files');
    return;
  }

  if (!config || typeof config !== 'object' || !config.hooks || typeof config.hooks !== 'object') {
    v.error(rel, 'must contain a top-level `hooks` object');
    v.requireMinimum(1, 1, 'hook configuration files');
    return;
  }

  let handlerCount = 0;

  for (const [event, matchers] of Object.entries(config.hooks)) {
    if (!VALID_EVENTS.has(event)) {
      v.error(rel, `unknown hook event \`${event}\``);
    }
    if (!Array.isArray(matchers)) {
      v.error(rel, `\`hooks.${event}\` must be an array`);
      continue;
    }
    for (const entry of matchers) {
      if (!entry || !Array.isArray(entry.hooks)) {
        v.error(rel, `\`hooks.${event}\` entry must contain a \`hooks\` array`);
        continue;
      }
      for (const handler of entry.hooks) {
        handlerCount += 1;
        if (!handler || !VALID_HANDLER_TYPES.has(handler.type)) {
          v.error(rel, `handler in \`hooks.${event}\` has unknown type \`${handler && handler.type}\``);
        }
        if (handler && handler.type === 'command' && !handler.command) {
          v.error(rel, `command handler in \`hooks.${event}\` has no \`command\``);
        }
        if (handler && !handler.id) {
          v.error(rel, `handler in \`hooks.${event}\` has no \`id\` — namespaced ids are required so a hook can be disabled by name`);
        }
      }
    }
  }

  v.requireMinimum(handlerCount, 1, 'hook handlers declared in hooks/hooks.json');
});
