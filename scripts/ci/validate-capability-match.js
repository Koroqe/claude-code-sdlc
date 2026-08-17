#!/usr/bin/env node
'use strict';

/**
 * Closes the highest-value gap this project has repeatedly shipped into:
 * an instruction NO AGENT COULD OBEY with the tools it was actually granted.
 *
 * Seven instances reached main across F3/F4/F5, every one caught by human
 * review and none by any mechanism:
 *
 *   - `verifier` told to stamp its report with a real timestamp — no `Bash`.
 *   - `planner` told to append its slices to the scratchpad — no `Write`.
 *   - `security-auditor` told to scope itself to a diff — no `Bash` to obtain one.
 *   - `/sdlc-fast` denied `Agent` while mandating an escalation that needs it.
 *   - `debugger` told to "append" to its log — holds `Write`, no `Edit`.
 *   - `verifier` (again) told to write to a path — the shipped agent grants
 *     `Write`, but the stale shadowing copy did not, and the run silently
 *     produced no file.
 *
 * The shape is always the same: prose says do X, frontmatter withholds the tool
 * X requires. Nothing compared the two, because they live in the same file but
 * are read by different eyes.
 *
 * ## Why this is a negation problem, not a keyword problem
 *
 * A naive scan is useless here. Every agent in this repo that lacks a tool
 * already SAYS SO in its own body — "You hold no `Edit` tool", "you cannot run
 * `git diff` yourself", "You have no `Write` or `Edit` tool and never will".
 * Those sentences are the FIX for this defect class, and a keyword scan flags
 * all of them: measured against HEAD, a bare pattern match produced 16 hits and
 * every single one was a negation. A validator with a 100% false-positive rate
 * on correct files gets switched off within a week.
 *
 * So the rule is: flag a tool-implying DIRECTIVE, and suppress it when the same
 * line is talking about the absence of that tool. Conservative by construction —
 * a line that both negates and directs is skipped. Under-reporting is the right
 * failure mode for a check whose credibility depends on a clean HEAD.
 *
 * ## What it cannot do
 *
 * It matches phrasing, not meaning. An instruction that needs `Bash` without
 * naming a command, or that implies a write without any of the listed verbs,
 * passes. This narrows a class that previously had nothing at all guarding it;
 * it does not eliminate it. Stated plainly rather than overstated, in keeping
 * with how the rest of this repo documents its own limits.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

// A directive that cannot be carried out without the keyed tool. Patterns are
// deliberately narrow: each one describes the agent performing an action, not
// merely naming a tool.
const DIRECTIVES = {
  Write: [
    { re: /\bWrite\s+(?:your|the|it|a)\b[^.\n]{0,60}\bto\s+`[^`]+`/i, why: 'writes to a named path' },
    { re: /\bwrite\s+(?:your|the)\s+(?:report|findings|output|file)\b/i, why: 'writes a report or file' },
    { re: /\bcreate\s+(?:the\s+)?file\s+`[^`]+`/i, why: 'creates a file' },
  ],
  Edit: [
    { re: /\bappend\s+(?:it\s+|the\s+|a\s+)?[^.\n]{0,40}\bto\s+`[^`]+`/i, why: 'appends to an existing file' },
    { re: /\b`Edit`\s+(?:that|the|its|it)\b/, why: 'edits a file in place' },
    { re: /\bedit\s+(?:that|the|its)\s+[^.\n]{0,30}\bin\s+place\b/i, why: 'edits in place' },
  ],
  Bash: [
    { re: /\brun\s+`[^`]+`/i, why: 'runs a shell command' },
    { re: /\bexecute\s+`[^`]+`/i, why: 'executes a shell command' },
    { re: /\bobtain\s+(?:the\s+)?(?:diff|timestamp)\b[^.\n]{0,30}\byourself\b/i, why: 'obtains data only a command can produce' },
  ],
  Agent: [
    { re: /\bdelegate\s+to\s+(?:the\s+)?`[a-z-]+`/i, why: 'delegates to a subagent' },
    { re: /\binvoke\s+(?:the\s+)?`[a-z-]+`\s+agent\b/i, why: 'invokes a subagent' },
    { re: /\bspawn\s+(?:a\s+|the\s+)?`?[a-z-]+`?\s+subagent\b/i, why: 'spawns a subagent' },
  ],
  WebFetch: [
    { re: /\bfetch\s+`?https?:\/\//i, why: 'fetches a URL' },
  ],
};

// If any of these appears on the same line, the line is discussing the tool's
// ABSENCE (which is the documented fix) rather than directing its use.
const NEGATION = /\b(?:no|not|never|cannot|can't|without|lacks?|denied|refuses?d?|must not|do not|don't|hold no|withheld|unavailable|absent)\b/i;

// Reflow into logical paragraphs before matching. A single LINE is the wrong
// unit: markdown wraps prose at ~100 columns, so a negation and the directive
// it governs routinely land on different lines. Measured on HEAD — checking
// line-by-line produced a false positive on `agents/debugger.md`, where "no
// `Edit` tool, so literal appending ... is not something you can" ends one line
// and the word it negates begins the next.
//
// Fenced code is blanked out: it carries examples and command contracts, not
// directives addressed to the agent.
function paragraphs(text) {
  const out = [];
  let fenced = false;
  let buf = [];
  let startLine = 1;

  const flush = () => {
    if (buf.length) out.push({ line: startLine, text: buf.join(' ') });
    buf = [];
  };

  text.split('\n').forEach((line, i) => {
    if (/^\s*```/.test(line)) { flush(); fenced = !fenced; return; }
    if (fenced) { flush(); return; }
    // A blank line, a heading, or a new list/numbered item starts a new unit.
    if (!line.trim() || /^\s*#{1,6}\s/.test(line) || /^\s*(?:[-*]|\d+\.)\s/.test(line)) {
      flush();
      if (!line.trim() || /^\s*#{1,6}\s/.test(line)) return;
      startLine = i + 1;
      buf = [line];
      return;
    }
    if (!buf.length) startLine = i + 1;
    buf.push(line);
  });
  flush();
  return out;
}

function parseList(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      return null;
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
}

function frontmatterField(text, field) {
  const m = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(text);
  return m ? parseList(m[1]) : null;
}

function checkFile(v, rel, text, field) {
  const granted = frontmatterField(text, field);
  if (granted === null) {
    v.error(rel, `has no parseable \`${field}\` frontmatter field, so its capabilities cannot be checked.`);
    return;
  }
  const have = new Set(granted);

  paragraphs(text).forEach((para) => {
    const line = para.text;
    if (NEGATION.test(line)) return; // discussing absence, not directing use
    for (const [tool, patterns] of Object.entries(DIRECTIVES)) {
      if (have.has(tool)) continue;
      for (const p of patterns) {
        if (p.re.test(line)) {
          v.error(
            rel,
            `line ${para.line} instructs an action that ${p.why}, but \`${field}\` does not grant ` +
              `\`${tool}\`. An instruction no agent can carry out with the tools it actually holds ` +
              `fails silently at runtime: the step is simply skipped and the run reports success. ` +
              `Either grant \`${tool}\` or reword the instruction to say who does it instead. ` +
              `Line: ${line.trim().slice(0, 120)}`
          );
          return;
        }
      }
    }
  });
}

function readDir(root, rel) {
  try {
    return fs.readdirSync(path.join(root, rel));
  } catch (err) {
    return [];
  }
}

core.run('validate-capability-match', (v, args) => {
  const root = args.root;
  let checked = 0;

  for (const name of readDir(root, 'agents').filter((f) => f.endsWith('.md'))) {
    const rel = path.join('agents', name);
    checkFile(v, rel, fs.readFileSync(path.join(root, rel), 'utf8'), 'tools');
    checked += 1;
  }

  for (const dir of readDir(root, 'skills')) {
    const rel = path.join('skills', dir, 'SKILL.md');
    if (!fs.existsSync(path.join(root, rel))) continue;
    checkFile(v, rel, fs.readFileSync(path.join(root, rel), 'utf8'), 'allowed-tools');
    checked += 1;
  }

  const minimum = args.min === null ? 20 : args.min;
  v.requireMinimum(checked, minimum, 'agent and skill files with declared capabilities');
  v.checkedCount = checked;
});
