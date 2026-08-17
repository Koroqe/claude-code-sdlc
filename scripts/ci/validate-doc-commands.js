#!/usr/bin/env node
'use strict';

/**
 * Checks that the commands the documentation tells people to run are commands
 * that actually work.
 *
 * Built after shipping a README whose HEADLINE install command did nothing:
 *
 *     curl -fsSL .../install.sh | bash
 *     -> Proceed with installation? [y/N]
 *     -> bash: line 257: /dev/tty: Device not configured
 *     -> [INFO]  Aborted.
 *
 * Under `curl | bash` there is no terminal for the confirmation prompt, so the
 * documented install aborted before touching anything. It survived review
 * because the verification run had quietly switched to a downloaded file with
 * `--yes` — a near-neighbour of the documented command, whose success was then
 * read as evidence for the command nobody had run.
 *
 * That is the same vacuity pattern as validating the wrong manifest, or an
 * `--expect-failure` step on a fixture that had stopped isolating: a check that
 * passes without exercising the thing it claims to cover.
 *
 * This validator is deliberately narrow. It does NOT execute anything — CI has
 * no Claude Code binary, no network, and executing an installer would be
 * absurd. It asserts the properties that were actually wrong:
 *
 *   1. Every `--flag` passed to `install.sh` in the docs is a flag `install.sh`
 *      actually parses. Doc drift here is silent: the installer ignores an
 *      unknown flag's intent and does something else.
 *   2. Any piped `curl ... install.sh | bash` form carries a non-interactive
 *      flag. Without it the prompt has no terminal and the install aborts.
 *   3. Local paths named in documented commands exist in the repository.
 *   4. Documented `claude plugin` subcommands are real subcommands.
 *
 * Scope note: it reads fenced shell blocks only. Prose mentioning a flag is not
 * a command someone copies, and treating it as one produced false positives on
 * sentences that discuss a flag rather than invoke it.
 */

const fs = require('fs');
const path = require('path');
const core = require('./lib/validate-core.js');

const DOCS = ['README.md', 'CONTRIBUTING.md'];

// Verified against `claude plugin --help` on Claude Code 2.1.9.
const PLUGIN_SUBCOMMANDS = new Set([
  'install', 'uninstall', 'remove', 'enable', 'disable', 'list', 'update',
  'validate', 'marketplace',
]);
const MARKETPLACE_SUBCOMMANDS = new Set(['add', 'remove', 'rm', 'list', 'update']);

// A piped installer has no controlling terminal, so it must not stop to ask.
const NONINTERACTIVE = /(?:^|\s)--yes(?:\s|$)/;

function fencedShell(text) {
  const blocks = [];
  const re = /```(bash|sh|shell|console)\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const startLine = text.slice(0, m.index).split('\n').length;
    m[2].split('\n').forEach((line, i) => {
      const trimmed = line.replace(/^\s*\$\s*/, '').trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      blocks.push({ line: startLine + 1 + i, cmd: trimmed.split('#')[0].trim() });
    });
  }
  return blocks;
}

function installerFlags(root) {
  let sh = '';
  try {
    sh = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  } catch (err) {
    return null;
  }
  const flags = new Set();
  // Argument parser arms look like `      --dry-run) DRY_RUN=true; shift ;;`
  for (const m of sh.matchAll(/^\s+(--[a-z-]+)\)/gm)) flags.add(m[1]);
  return flags;
}

function checkInstallSh(v, rel, entry, flags) {
  const { cmd, line } = entry;
  if (!/\binstall\.sh\b/.test(cmd)) return;

  for (const m of cmd.matchAll(/(?:^|\s)(--[a-z-]+)/g)) {
    const flag = m[1];
    // `bash -s -- --yes` passes flags through; they are still install.sh flags.
    if (flag === '--') continue;
    if (!flags.has(flag)) {
      v.error(
        rel,
        `line ${line}: documents \`install.sh ${flag}\`, but install.sh has no such flag ` +
          `(it parses: ${[...flags].sort().join(' ')}). An unknown flag is not rejected loudly — ` +
          `the reader believes they configured something they did not. Command: ${cmd}`
      );
    }
  }

  const piped = /\|\s*(?:sudo\s+)?bash\b/.test(cmd) || /\|\s*sh\b/.test(cmd);
  if (piped && !NONINTERACTIVE.test(cmd)) {
    v.error(
      rel,
      `line ${line}: pipes install.sh into a shell without a non-interactive flag. ` +
        `install.sh asks for confirmation, and a piped shell has no terminal to answer from — ` +
        `this exact form aborted with "/dev/tty: Device not configured" and installed nothing. ` +
        `Use \`| bash -s -- --yes\`. Command: ${cmd}`
    );
  }
}

function checkClaudePlugin(v, rel, entry) {
  const { cmd, line } = entry;
  const m = /\bclaude\s+plugin\s+([a-z-]+)/.exec(cmd);
  if (!m) return;
  const sub = m[1];
  if (!PLUGIN_SUBCOMMANDS.has(sub)) {
    v.error(
      rel,
      `line ${line}: documents \`claude plugin ${sub}\`, which is not a known subcommand ` +
        `(${[...PLUGIN_SUBCOMMANDS].sort().join(', ')}). Command: ${cmd}`
    );
    return;
  }
  if (sub === 'marketplace') {
    const mm = /\bclaude\s+plugin\s+marketplace\s+([a-z-]+)/.exec(cmd);
    if (mm && !MARKETPLACE_SUBCOMMANDS.has(mm[1])) {
      v.error(
        rel,
        `line ${line}: documents \`claude plugin marketplace ${mm[1]}\`, which is not a known ` +
          `subcommand (${[...MARKETPLACE_SUBCOMMANDS].sort().join(', ')}). Command: ${cmd}`
      );
    }
  }
}

function checkLocalPaths(v, root, rel, entry) {
  const { cmd, line } = entry;
  for (const m of cmd.matchAll(/\b(?:bash|node|sh)\s+([\w./-]+\.(?:sh|js))\b/g)) {
    const target = m[1];
    if (target.startsWith('/') || target.includes('..')) continue;
    if (!fs.existsSync(path.join(root, target))) {
      v.error(
        rel,
        `line ${line}: documents running \`${target}\`, which does not exist in the repository. ` +
          `Command: ${cmd}`
      );
    }
  }
}

core.run('validate-doc-commands', (v, args) => {
  const root = args.root;
  const flags = installerFlags(root);
  if (flags === null) {
    v.error('install.sh', 'not found, so documented installer flags cannot be checked.');
    return;
  }

  let commands = 0;
  let docsSeen = 0;
  for (const rel of DOCS) {
    let text = null;
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch (err) {
      continue; // CONTRIBUTING.md is optional
    }
    docsSeen += 1;
    for (const entry of fencedShell(text)) {
      commands += 1;
      checkInstallSh(v, rel, entry, flags);
      checkClaudePlugin(v, rel, entry);
      checkLocalPaths(v, root, rel, entry);
    }
  }

  const minimum = args.min === null ? 5 : args.min;
  v.requireMinimum(commands, minimum, 'documented shell commands in fenced blocks');
  v.checkedCount = docsSeen;
});
