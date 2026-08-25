#!/usr/bin/env node
'use strict';

/**
 * Validates every agent definition under `agents/`.
 *
 * Checks (PRD Section 6, FR-5.2):
 *   - frontmatter parses
 *   - `name` matches the filename
 *   - `name`, `description`, `tools`, `model`, `effort` are all present and non-empty
 *   - every entry in `tools` is a real Claude Code tool
 *   - `model` is a recognised alias, `inherit`, or an explicit model id
 *   - `effort` is one of `low`, `medium`, `high`
 *
 * The expected agent count is a floor, not an equality check — adding a
 * fourteenth agent must not require editing this validator (QA 18.2.4).
 */

const path = require('path');
const fs = require('fs');
const core = require('./lib/validate-core.js');

const MIN_AGENTS = 13;

const VALID_TOOLS = new Set([
  'Agent', 'AskUserQuestion', 'Bash', 'Edit', 'Glob', 'Grep', 'NotebookEdit',
  'Read', 'Skill', 'TodoWrite', 'WebFetch', 'WebSearch', 'Write',
]);

const VALID_MODEL_ALIASES = new Set(['opus', 'sonnet', 'haiku', 'fable', 'fast', 'inherit']);
const EXPLICIT_MODEL_ID = /^claude-[a-z0-9.-]+$/;
const VALID_EFFORT_LEVELS = new Set(['low', 'medium', 'high']);
const REQUIRED_FIELDS = ['name', 'description', 'tools', 'model', 'effort'];
// A runaway agent is bounded by nothing else in this harness: retry budgets are
// per-slice and per-gate, not per-agent. Measured on this repo's own 85-record
// wave corpus, a subagent uses a median of 19 tool calls, p90 53, max 81 — so a
// backstop only earns its place well ABOVE that, where it can only ever catch a
// pathological loop. Measured 2026-08-24: maxTurns IS honoured, and a value set
// too LOW is its own failure mode — a bounded agent returns a confident preamble
// having done no work at all, which reads like progress. Generous, not tight.
const MIN_SANE_MAX_TURNS = 40;

core.run('validate-agents', (v, args) => {
  const dir = path.join(args.root, 'agents');
  const files = core.listFiles(dir, (n) => n.endsWith('.md'));

  const minimum = args.min === null ? MIN_AGENTS : args.min;
  if (!v.requireMinimum(files.length, minimum, `agent definitions in ${path.relative(args.root, dir) || 'agents'}/`)) {
    return;
  }

  for (const file of files) {
    const rel = path.relative(args.root, file);
    const parsed = core.parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!parsed.ok) {
      v.error(rel, parsed.error);
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!parsed.data[field]) {
        v.error(rel, `missing or empty required frontmatter field \`${field}\``);
      }
    }
    if (REQUIRED_FIELDS.some((f) => !parsed.data[f])) continue;

    const expectedName = path.basename(file, '.md');
    if (parsed.data.name !== expectedName) {
      v.error(rel, `frontmatter \`name: ${parsed.data.name}\` does not match filename (expected \`${expectedName}\`)`);
    }

    const tools = core.parseList(parsed.data.tools);
    if (tools.length === 0) {
      v.error(rel, '`tools` is present but lists no tools');
    }
    for (const tool of tools) {
      const base = tool.split('(')[0].trim();
      if (!VALID_TOOLS.has(base) && !base.startsWith('mcp__')) {
        v.error(rel, `unknown tool \`${tool}\` in \`tools\``);
      }
    }

    const model = parsed.data.model;
    if (!VALID_MODEL_ALIASES.has(model) && !EXPLICIT_MODEL_ID.test(model)) {
      v.error(
        rel,
        `\`model: ${model}\` is not a known alias (${[...VALID_MODEL_ALIASES].join(', ')}) ` +
        'or an explicit `claude-*` model id'
      );
    }

    const effort = parsed.data.effort;
    const maxTurns = parsed.data.maxTurns;
    if (maxTurns === undefined || maxTurns === null || maxTurns === '') {
      v.error(rel, 'missing required frontmatter field `maxTurns` — every agent needs a runaway backstop');
    } else if (!/^\d+$/.test(String(maxTurns).trim()) ||
               Number(String(maxTurns).trim()) < MIN_SANE_MAX_TURNS) {
      v.error(rel, '`maxTurns` must be an integer >= ' + MIN_SANE_MAX_TURNS +
        ' (a tight bound makes an agent return a preamble having done no work — measured); got ' + maxTurns);
    }

    if (!VALID_EFFORT_LEVELS.has(effort)) {
      v.error(
        rel,
        `\`effort: ${effort}\` is not a known level (${[...VALID_EFFORT_LEVELS].join(', ')})`
      );
    }
  }
});
