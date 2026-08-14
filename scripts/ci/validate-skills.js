#!/usr/bin/env node
'use strict';

/**
 * Validates every skill under `skills/<name>/SKILL.md`.
 *
 * Checks (PRD Section 6, FR-5.3 and FR-2.3):
 *   - frontmatter parses
 *   - `description`, `argument-hint`, `arguments`, `allowed-tools` are all
 *     present and non-empty — the four fields FR-2.3 mandates
 *   - every entry in `allowed-tools` is a real Claude Code tool
 *   - the two entry-point skills carry the FR-8 memory-layer preflight, and
 *     that preflight warns rather than blocks
 *
 * The expected skill count is a floor, not an equality check.
 */

const path = require('path');
const fs = require('fs');
const core = require('./lib/validate-core.js');

const MIN_SKILLS = 5;

const REQUIRED_FIELDS = ['description', 'argument-hint', 'arguments', 'allowed-tools'];

const VALID_TOOLS = new Set([
  'Agent', 'AskUserQuestion', 'Bash', 'Edit', 'Glob', 'Grep', 'NotebookEdit',
  'Read', 'Skill', 'TodoWrite', 'WebFetch', 'WebSearch', 'Write',
]);

/** FR-8: these skills are the pipeline's entry points and must preflight. */
const ENTRY_POINT_SKILLS = ['develop-feature', 'bootstrap-feature'];
const PREFLIGHT_MARKER = 'Autonomous Development Workflow (MANDATORY)';
const PREFLIGHT_REMEDY = 'bash install.sh';

core.run('validate-skills', (v, args) => {
  const dir = path.join(args.root, 'skills');
  const files = core.listNestedFiles(dir, 'SKILL.md');

  const minimum = args.min === null ? MIN_SKILLS : args.min;
  if (!v.requireMinimum(files.length, minimum, `skills at ${path.relative(args.root, dir) || 'skills'}/*/SKILL.md`)) {
    return;
  }

  const seen = new Set();

  for (const file of files) {
    const rel = path.relative(args.root, file);
    const skillName = path.basename(path.dirname(file));
    seen.add(skillName);

    const text = fs.readFileSync(file, 'utf8');
    const parsed = core.parseFrontmatter(text);
    if (!parsed.ok) {
      v.error(rel, parsed.error);
      continue;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!parsed.data[field]) {
        v.error(rel, `missing or empty required frontmatter field \`${field}\``);
      }
    }

    for (const tool of core.parseList(parsed.data['allowed-tools'])) {
      const base = tool.split('(')[0].trim();
      if (!VALID_TOOLS.has(base) && !base.startsWith('mcp__')) {
        v.error(rel, `unknown tool \`${tool}\` in \`allowed-tools\``);
      }
    }

    if (ENTRY_POINT_SKILLS.includes(skillName)) {
      if (!text.includes(PREFLIGHT_MARKER)) {
        v.error(rel, `entry-point skill is missing the FR-8 memory-layer preflight (no reference to "${PREFLIGHT_MARKER}")`);
      }
      if (!text.includes(PREFLIGHT_REMEDY)) {
        v.error(rel, `FR-8 preflight does not name \`${PREFLIGHT_REMEDY}\` as the remedy`);
      }
      if (!/continue anyway|never block/i.test(text)) {
        v.error(rel, 'FR-8 preflight must state that it warns and continues — a preflight that can block would dead-end an unattended run');
      }
    }
  }

  for (const required of ENTRY_POINT_SKILLS) {
    if (!seen.has(required)) {
      v.error('(scope)', `required entry-point skill \`${required}\` not found under skills/`);
    }
  }
});
